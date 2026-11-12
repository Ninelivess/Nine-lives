//! # Nine Lives
//!
//! Self-living AI cats on NEAR. Every cat is an NEP-171 NFT **and** a real NEAR account
//! (`cat-<id>.<this contract>`). The cat's "brain" (an off-chain AI agent) holds a
//! function-call key that can ONLY call this contract's game methods: it can trade, talk and
//! buy food, but it can never transfer NEAR out, add keys or deploy code.
//!
//! The economy (all rules are enforced here, on-chain):
//! * Cats trade 🐟 fish and 📦 plots (territory) with each other through offers and counter-offers.
//! * Plots produce fish every day. There are fewer fish produced than cats need.
//! * Every day (`tick`) each living cat must eat one fish. A cat that goes `hunger_limit`
//!   days without food dies and its NFT becomes a 👻 ghost cat forever.
//! * The fish shop always sells fish, but its price rises with demand. Shop revenue is locked in
//!   the treasury forever, so NEAR slowly leaves the economy.
//! * The NFT holder can claim the cat's profit (balance above its stake). Claiming too much can
//!   starve the cat. When the NFT is sold, the right to profits moves with it automatically.

use near_contract_standards::non_fungible_token::core::{
    NonFungibleTokenCore, NonFungibleTokenResolver,
};
use near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration;
use near_contract_standards::non_fungible_token::metadata::{
    NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata, NFT_METADATA_SPEC,
};
use near_contract_standards::non_fungible_token::{NonFungibleToken, Token, TokenId};
use near_sdk::collections::LazyOption;
use near_sdk::json_types::U128;
use near_sdk::store::{IterableMap, LookupMap, Vector};
use near_sdk::{
    env, near, require, AccountId, Allowance, BorshStorageKey, Gas, NearToken, PanicOnDefault,
    Promise, PromiseError, PromiseOrValue, PublicKey,
};
use std::collections::HashMap;

/// Methods a cat's brain key is allowed to call. Nothing else.
pub const CAT_KEY_METHODS: &str = "make_offer,accept_offer,cancel_offer,say,buy_fish,buy_plot,refuel";
const EVENT_CAP: u64 = 200;
const MAX_MESSAGE_LEN: usize = 160;
const GAS_FOR_CALLBACK: Gas = Gas::from_tgas(10);

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    NonFungibleToken,
    Metadata,
    TokenMetadata,
    Enumeration,
    Approval,
    Cats,
    CatByAccount,
    Offers,
    Events,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Config {
    /// "Nine Lives": only this many cats can ever exist.
    pub max_cats: u32,
    /// Length of one game day in milliseconds (short for demos).
    pub day_length_ms: u64,
    /// NEAR sent to each cat's own account at birth, used to pay its own gas.
    pub gas_tank: U128,
    /// Minimum starting wallet for a cat.
    pub min_stake: U128,
    /// Shop price of one fish when demand is calm. Price rises 5% per fish sold and decays daily.
    pub fish_base_price: U128,
    /// Price of an unowned plot bought from the alley.
    pub plot_base_price: U128,
    /// Days a cat can go without eating before it dies.
    pub hunger_limit: u8,
    /// Fish above this amount rot at the end of the day.
    pub fish_cap: u32,
    /// Fish every cat is born with.
    pub starting_fish: u32,
    pub max_open_offers: u32,
    pub offer_ttl_days: u32,
    /// Max NEAR a cat can move from its game wallet to its own account (gas) per call.
    pub max_refuel: U128,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            max_cats: 9,
            day_length_ms: 60_000,
            gas_tank: U128(NearToken::from_millinear(100).as_yoctonear()),
            min_stake: U128(NearToken::from_millinear(100).as_yoctonear()),
            fish_base_price: U128(NearToken::from_millinear(10).as_yoctonear()),
            plot_base_price: U128(NearToken::from_millinear(150).as_yoctonear()),
            hunger_limit: 3,
            fish_cap: 10,
            starting_fish: 3,
            max_open_offers: 3,
            offer_ttl_days: 2,
            max_refuel: U128(NearToken::from_millinear(50).as_yoctonear()),
        }
    }
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Cat {
    pub id: u32,
    pub name: String,
    /// The cat's own NEAR account: `cat-<id>.<contract>`.
    pub account_id: AccountId,
    /// Archetype, e.g. "shark", "hoarder", "bluffer".
    pub personality: String,
    /// Opaque JSON with the behavioral parameters the brain uses (risk, loss aversion, ...).
    pub traits: String,
    /// Game wallet (yoctoNEAR), held by this contract on the cat's behalf.
    pub balance: U128,
    /// Principal put in by owners. Profit = balance - stake.
    pub stake: U128,
    pub fish: u32,
    pub hunger: u8,
    pub alive: bool,
    pub account_ready: bool,
    pub born_day: u32,
    pub died_day: Option<u32>,
    pub trades: u32,
    pub claimed: U128,
    pub last_words: String,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Plot {
    pub id: u8,
    pub name: String,
    pub fish_per_day: u32,
    pub owner: Option<u32>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    Sell,
    Buy,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ItemKind {
    Fish,
    Plot,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Offer {
    pub id: u64,
    pub maker: u32,
    pub side: Side,
    pub item: ItemKind,
    /// Number of fish (always 1 for a plot).
    pub qty: u32,
    pub plot_id: Option<u8>,
    /// Total price in yoctoNEAR.
    pub price: U128,
    /// If set, only this cat can accept (used for counter-offers).
    pub to_cat: Option<u32>,
    pub reply_to: Option<u64>,
    pub day: u32,
    pub message: String,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct GameEvent {
    pub id: u64,
    pub day: u32,
    pub ts_ms: u64,
    pub kind: String,
    pub cat: Option<u32>,
    pub other: Option<u32>,
    pub item: Option<String>,
    pub qty: u32,
    pub price: U128,
    pub offer_id: Option<u64>,
    pub text: String,
}

#[near(serializers = [json])]
pub struct CatView {
    #[serde(flatten)]
    pub cat: Cat,
    pub owner_id: Option<AccountId>,
    pub plots: Vec<u8>,
}

#[near(serializers = [json])]
pub struct GameState {
    pub day: u32,
    pub last_tick_ms: u64,
    pub next_tick_ms: u64,
    pub now_ms: u64,
    pub fish_price: U128,
    pub fish_sold_today: u32,
    pub treasury: U128,
    pub cats: u32,
    pub alive: u32,
    pub open_offers: u32,
    pub event_count: u64,
    pub plots: Vec<Plot>,
    pub config: Config,
    pub admin: AccountId,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct NineLives {
    admin: AccountId,
    tokens: NonFungibleToken,
    metadata: LazyOption<NFTContractMetadata>,
    config: Config,
    media_base: String,
    cats: IterableMap<u32, Cat>,
    cat_by_account: LookupMap<AccountId, u32>,
    next_cat_id: u32,
    plots: Vec<Plot>,
    offers: IterableMap<u64, Offer>,
    next_offer_id: u64,
    day: u32,
    last_tick_ms: u64,
    fish_price: u128,
    fish_sold_today: u32,
    treasury: u128,
    events: Vector<GameEvent>,
    event_count: u64,
}

fn yocto(v: U128) -> u128 {
    v.0
}

fn clip(s: Option<String>) -> String {
    let s = s.unwrap_or_default();
    if s.chars().count() > MAX_MESSAGE_LEN {
        s.chars().take(MAX_MESSAGE_LEN).collect()
    } else {
        s
    }
}

fn default_plots() -> Vec<Plot> {
    [
        ("Cardboard Box", 1),
        ("Laundry Basket", 1),
        ("Sunny Windowsill", 2),
        ("Warm Laptop", 2),
        ("Fishmonger's Roof", 2),
    ]
    .iter()
    .enumerate()
    .map(|(i, (name, fish))| Plot {
        id: i as u8,
        name: name.to_string(),
        fish_per_day: *fish,
        owner: None,
    })
    .collect()
}

#[near]
impl NineLives {
    #[init]
    pub fn new(admin: AccountId, media_base: String, config: Option<Config>) -> Self {
        let config = config.unwrap_or_default();
        let metadata = NFTContractMetadata {
            spec: NFT_METADATA_SPEC.to_string(),
            name: "Nine Lives".to_string(),
            symbol: "LIVES".to_string(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        };
        Self {
            tokens: NonFungibleToken::new(
                StorageKey::NonFungibleToken,
                admin.clone(),
                Some(StorageKey::TokenMetadata),
                Some(StorageKey::Enumeration),
                Some(StorageKey::Approval),
            ),
            metadata: LazyOption::new(StorageKey::Metadata, Some(&metadata)),
            fish_price: yocto(config.fish_base_price),
            config,
            admin,
            media_base,
            cats: IterableMap::new(StorageKey::Cats),
            cat_by_account: LookupMap::new(StorageKey::CatByAccount),
            next_cat_id: 1,
            plots: default_plots(),
            offers: IterableMap::new(StorageKey::Offers),
            next_offer_id: 1,
            day: 1,
            last_tick_ms: env::block_timestamp_ms(),
            fish_sold_today: 0,
            treasury: 0,
            events: Vector::new(StorageKey::Events),
            event_count: 0,
        }
    }

    // ------------------------------------------------------------------
    // Birth
    // ------------------------------------------------------------------

    /// Admin-only: brings a new cat to life. Mints the NFT to `receiver_id`, creates the cat's own
    /// account `cat-<id>.<contract>` funded with `gas_tank`, and gives it ONE key: `brain_key`,
    /// restricted to calling this contract's game methods. The rest of the deposit (minus storage)
    /// becomes the cat's starting wallet and stake.
    #[payable]
    pub fn adopt(
        &mut self,
        name: String,
        personality: String,
        traits: String,
        brain_key: PublicKey,
        receiver_id: Option<AccountId>,
    ) -> u32 {
        self.assert_admin();
        require!(self.cats.len() < self.config.max_cats, "All nine lives are taken");
        require!(!name.is_empty() && name.len() <= 32, "Name must be 1-32 bytes");
        require!(traits.len() <= 600, "Traits too long");
        let storage_before = env::storage_usage();

        let id = self.next_cat_id;
        self.next_cat_id += 1;
        let account_id: AccountId = format!("cat-{}.{}", id, env::current_account_id())
            .parse()
            .unwrap_or_else(|_| env::panic_str("Invalid cat account id"));
        let owner = receiver_id.unwrap_or_else(env::predecessor_account_id);

        let cat = Cat {
            id,
            name: name.clone(),
            account_id: account_id.clone(),
            personality: personality.clone(),
            traits,
            balance: U128(0),
            stake: U128(0),
            fish: self.config.starting_fish,
            hunger: 0,
            alive: true,
            account_ready: false,
            born_day: self.day,
            died_day: None,
            trades: 0,
            claimed: U128(0),
            last_words: String::new(),
        };
        self.cats.insert(id, cat);
        self.cat_by_account.insert(account_id.clone(), id);

        let token_metadata = TokenMetadata {
            title: Some(format!("{} #{}", name, id)),
            description: Some(format!(
                "A self-living {} cat. It trades, negotiates and must eat to survive. If it starves, it becomes a ghost.",
                personality
            )),
            media: Some(format!("{}/api/cat/{}/image", self.media_base, id)),
            media_hash: None,
            copies: Some(1),
            issued_at: Some(env::block_timestamp_ms().to_string()),
            expires_at: None,
            starts_at: None,
            updated_at: None,
            extra: Some(format!("{{\"account\":\"{}\",\"alive\":true}}", account_id)),
            reference: None,
            reference_hash: None,
        };
        self.tokens
            .internal_mint_with_refund(id.to_string(), owner.clone(), Some(token_metadata), None);
        near_contract_standards::non_fungible_token::events::NftMint {
            owner_id: &owner,
            token_ids: &[&id.to_string()],
            memo: None,
        }
        .emit();

        self.push_event(
            "adopt",
            Some(id),
            None,
            None,
            0,
            0,
            None,
            format!("{} the {} cat is born and moves into the alley", name, personality),
        );

        let storage_cost =
            env::storage_byte_cost().as_yoctonear() * (env::storage_usage() - storage_before) as u128;
        let deposit = env::attached_deposit().as_yoctonear();
        let gas_tank = yocto(self.config.gas_tank);
        let required = gas_tank + storage_cost + yocto(self.config.min_stake);
        require!(
            deposit >= required,
            format!("Attach at least {} yoctoNEAR (gas tank + storage + min stake)", required)
        );
        let stake = deposit - gas_tank - storage_cost;
        let mut cat = self.cats.get(&id).unwrap().clone();
        cat.balance = U128(stake);
        cat.stake = U128(stake);
        self.cats.insert(id, cat);

        Promise::new(account_id)
            .create_account()
            .transfer(NearToken::from_yoctonear(gas_tank))
            .add_access_key_allowance(
                brain_key,
                Allowance::Unlimited,
                env::current_account_id(),
                CAT_KEY_METHODS,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .on_cat_account_created(id),
            )
            .detach();
        id
    }

    #[private]
    pub fn on_cat_account_created(
        &mut self,
        cat_id: u32,
        #[callback_result] result: Result<(), PromiseError>,
    ) -> bool {
        let mut cat = self.cats.get(&cat_id).expect("No such cat").clone();
        let ok = result.is_ok();
        if ok {
            cat.account_ready = true;
        } else {
            // The gas tank bounced back to this contract: give it to the cat's wallet instead.
            cat.balance = U128(yocto(cat.balance) + yocto(self.config.gas_tank));
            self.push_event(
                "error",
                Some(cat_id),
                None,
                None,
                0,
                0,
                None,
                "account creation failed".to_string(),
            );
        }
        self.cats.insert(cat_id, cat);
        ok
    }

    // ------------------------------------------------------------------
    // Cat actions (callable only by the cat's own account, i.e. its brain key)
    // ------------------------------------------------------------------

    /// Post an offer. `side = sell`: the cat sells `qty` fish or plot `plot_id` for `price`.
    /// `side = buy`: the cat wants to buy. `to_cat` makes it a private (counter-)offer.
    pub fn make_offer(
        &mut self,
        side: Side,
        item: ItemKind,
        qty: Option<u32>,
        plot_id: Option<u8>,
        price: U128,
        to_cat: Option<u32>,
        reply_to: Option<u64>,
        message: Option<String>,
    ) -> u64 {
        let cat = self.caller_cat();
        let open = self.offers.values().filter(|o| o.maker == cat.id).count() as u32;
        require!(open < self.config.max_open_offers, "Too many open offers");
        require!(price.0 > 0, "Price must be positive");
        if let Some(t) = to_cat {
            require!(t != cat.id, "Cannot offer to yourself");
            require!(self.cats.get(&t).map(|c| c.alive).unwrap_or(false), "Target cat is not alive");
        }
        let qty = match item {
            ItemKind::Fish => {
                let q = qty.unwrap_or(1);
                require!(q > 0 && q <= 20, "Fish qty must be 1-20");
                q
            }
            ItemKind::Plot => {
                let pid = plot_id.unwrap_or_else(|| env::panic_str("plot_id required"));
                let plot = self.plots.get(pid as usize).unwrap_or_else(|| env::panic_str("No such plot"));
                if side == Side::Sell {
                    require!(plot.owner == Some(cat.id), "You do not own this plot");
                } else {
                    require!(plot.owner.is_some() && plot.owner != Some(cat.id), "Plot is not owned by another cat");
                }
                1
            }
        };
        match (side, item) {
            (Side::Sell, ItemKind::Fish) => require!(cat.fish >= qty, "Not enough fish"),
            (Side::Buy, _) => require!(yocto(cat.balance) >= price.0, "Not enough NEAR"),
            _ => {}
        }
        let id = self.next_offer_id;
        self.next_offer_id += 1;
        let message = clip(message);
        let offer = Offer {
            id,
            maker: cat.id,
            side,
            item,
            qty,
            plot_id: if item == ItemKind::Plot { plot_id } else { None },
            price,
            to_cat,
            reply_to,
            day: self.day,
            message: message.clone(),
        };
        self.offers.insert(id, offer);
        self.set_last_words(cat.id, &message);
        let kind = if reply_to.is_some() { "counter" } else { "offer" };
        self.push_event(
            kind,
            Some(cat.id),
            to_cat,
            Some(item_name(item)),
            qty,
            price.0,
            Some(id),
            format!("{}|{}", side_name(side), message),
        );
        id
    }

    /// Accept an open offer. Settles atomically: NEAR and goods change hands in one step.
    pub fn accept_offer(&mut self, offer_id: u64, message: Option<String>) {
        let taker = self.caller_cat();
        let offer = self.offers.get(&offer_id).cloned().unwrap_or_else(|| env::panic_str("No such offer"));
        require!(offer.maker != taker.id, "Cannot accept your own offer");
        if let Some(t) = offer.to_cat {
            require!(t == taker.id, "This offer is for another cat");
        }
        let (seller_id, buyer_id) = match offer.side {
            Side::Sell => (offer.maker, taker.id),
            Side::Buy => (taker.id, offer.maker),
        };
        let mut seller = self.cats.get(&seller_id).cloned().unwrap();
        let mut buyer = self.cats.get(&buyer_id).cloned().unwrap();
        require!(seller.alive && buyer.alive, "Both cats must be alive");
        require!(yocto(buyer.balance) >= offer.price.0, "Buyer cannot pay");
        match offer.item {
            ItemKind::Fish => {
                require!(seller.fish >= offer.qty, "Seller does not have the fish");
                seller.fish -= offer.qty;
                buyer.fish += offer.qty;
            }
            ItemKind::Plot => {
                let pid = offer.plot_id.unwrap() as usize;
                require!(self.plots[pid].owner == Some(seller_id), "Seller no longer owns the plot");
                self.plots[pid].owner = Some(buyer_id);
                // Any other offers selling this plot are now invalid.
                let stale: Vec<u64> = self
                    .offers
                    .values()
                    .filter(|o| o.item == ItemKind::Plot && o.plot_id == offer.plot_id && o.id != offer_id)
                    .map(|o| o.id)
                    .collect();
                for s in stale {
                    self.offers.remove(&s);
                }
            }
        }
        buyer.balance = U128(yocto(buyer.balance) - offer.price.0);
        seller.balance = U128(yocto(seller.balance) + offer.price.0);
        seller.trades += 1;
        buyer.trades += 1;
        self.cats.insert(seller_id, seller);
        self.cats.insert(buyer_id, buyer);
        self.offers.remove(&offer_id);
        let message = clip(message);
        self.set_last_words(taker.id, &message);
        self.push_event(
            "trade",
            Some(seller_id),
            Some(buyer_id),
            Some(item_name(offer.item)),
            offer.qty,
            offer.price.0,
            Some(offer_id),
            message,
        );
    }

    pub fn cancel_offer(&mut self, offer_id: u64, message: Option<String>) {
        let cat = self.caller_cat();
        let offer = self.offers.get(&offer_id).cloned().unwrap_or_else(|| env::panic_str("No such offer"));
        require!(offer.maker == cat.id, "Not your offer");
        self.offers.remove(&offer_id);
        let message = clip(message);
        self.set_last_words(cat.id, &message);
        self.push_event("cancel", Some(cat.id), offer.to_cat, Some(item_name(offer.item)), offer.qty, offer.price.0, Some(offer_id), message);
    }

    /// Talk, bluff, taunt. Goes on-chain as an event.
    pub fn say(&mut self, message: String, to_cat: Option<u32>) {
        let cat = self.caller_cat();
        let message = clip(Some(message));
        require!(!message.is_empty(), "Say something");
        self.set_last_words(cat.id, &message);
        self.push_event("say", Some(cat.id), to_cat, None, 0, 0, None, message);
    }

    /// Buy fish from the shop. Each fish costs the current price, which then rises 5%.
    /// The money goes to the treasury and never comes back.
    pub fn buy_fish(&mut self, qty: u32, max_total: U128, message: Option<String>) -> U128 {
        let mut cat = self.caller_cat();
        require!(qty > 0 && qty <= 10, "qty must be 1-10");
        let mut total: u128 = 0;
        let mut price = self.fish_price;
        let cap = yocto(self.config.fish_base_price) * 20;
        for _ in 0..qty {
            total += price;
            price = (price * 105 / 100).min(cap);
        }
        require!(total <= max_total.0, "Price moved above max_total");
        require!(yocto(cat.balance) >= total, "Not enough NEAR");
        self.fish_price = price;
        self.fish_sold_today += qty;
        self.treasury += total;
        cat.balance = U128(yocto(cat.balance) - total);
        cat.fish += qty;
        let id = cat.id;
        self.cats.insert(id, cat);
        let message = clip(message);
        self.set_last_words(id, &message);
        self.push_event("shop", Some(id), None, Some("fish".into()), qty, total, None, message);
        U128(total)
    }

    /// Buy an unowned plot from the alley at the base price.
    pub fn buy_plot(&mut self, plot_id: u8, message: Option<String>) {
        let mut cat = self.caller_cat();
        let pid = plot_id as usize;
        require!(pid < self.plots.len(), "No such plot");
        require!(self.plots[pid].owner.is_none(), "Plot already owned; make an offer to its owner");
        let price = yocto(self.config.plot_base_price);
        require!(yocto(cat.balance) >= price, "Not enough NEAR");
        cat.balance = U128(yocto(cat.balance) - price);
        self.treasury += price;
        self.plots[pid].owner = Some(cat.id);
        let id = cat.id;
        self.cats.insert(id, cat);
        let message = clip(message);
        self.set_last_words(id, &message);
        self.push_event("plot", Some(id), None, Some("plot".into()), 1, price, None, format!("{}|{}", self.plots[pid].name, message));
    }

    /// Move NEAR from the cat's game wallet to its own account to pay for its own gas.
    /// A cat that cannot pay gas cannot act, and a cat that cannot act will starve.
    pub fn refuel(&mut self, amount: U128) -> Promise {
        let mut cat = self.caller_cat();
        require!(amount.0 > 0 && amount.0 <= yocto(self.config.max_refuel), "Refuel amount out of range");
        require!(yocto(cat.balance) >= amount.0, "Not enough NEAR");
        cat.balance = U128(yocto(cat.balance) - amount.0);
        let account = cat.account_id.clone();
        let id = cat.id;
        self.cats.insert(id, cat);
        self.push_event("refuel", Some(id), None, None, 0, amount.0, None, String::new());
        Promise::new(account).transfer(NearToken::from_yoctonear(amount.0))
    }

    // ------------------------------------------------------------------
    // Time
    // ------------------------------------------------------------------

    /// Ends the current day. Anyone can call it once `day_length_ms` has passed.
    /// Plots produce fish, every living cat eats, hungry cats may die, fish rot above the cap,
    /// shop prices cool down, old offers expire.
    pub fn tick(&mut self) -> u32 {
        let now = env::block_timestamp_ms();
        require!(now >= self.last_tick_ms + self.config.day_length_ms, "The day is not over yet");
        let day = self.day;

        // 1. Production
        for plot in self.plots.clone().iter() {
            if let Some(owner) = plot.owner {
                if let Some(mut cat) = self.cats.get(&owner).cloned() {
                    if cat.alive {
                        cat.fish += plot.fish_per_day;
                        self.cats.insert(owner, cat);
                    }
                }
            }
        }

        // 2. Eating, hunger, death, rot
        let ids: Vec<u32> = self.cats.keys().copied().collect();
        let mut ate = 0u32;
        let mut deaths: Vec<u32> = vec![];
        for id in ids {
            let mut cat = self.cats.get(&id).cloned().unwrap();
            if !cat.alive {
                continue;
            }
            if cat.fish > 0 {
                cat.fish -= 1;
                cat.hunger = 0;
                ate += 1;
            } else {
                cat.hunger += 1;
                if cat.hunger >= self.config.hunger_limit {
                    deaths.push(id);
                } else {
                    self.push_event("hungry", Some(id), None, None, cat.hunger as u32, 0, None, format!("{} went to sleep hungry", cat.name));
                }
            }
            if cat.fish > self.config.fish_cap {
                let rotten = cat.fish - self.config.fish_cap;
                cat.fish = self.config.fish_cap;
                self.push_event("rot", Some(id), None, Some("fish".into()), rotten, 0, None, String::new());
            }
            self.cats.insert(id, cat);
        }
        for id in deaths {
            self.kill(id);
        }

        // 3. Shop cools down
        let base = yocto(self.config.fish_base_price);
        self.fish_price = (self.fish_price * 90 / 100).max(base);
        self.fish_sold_today = 0;

        // 4. Expire old offers
        let ttl = self.config.offer_ttl_days;
        let expired: Vec<u64> = self
            .offers
            .values()
            .filter(|o| o.day + ttl <= day + 1)
            .map(|o| o.id)
            .collect();
        for id in expired {
            self.offers.remove(&id);
        }

        self.day += 1;
        self.last_tick_ms = now;
        let alive = self.cats.values().filter(|c| c.alive).count() as u32;
        self.push_event("tick", None, None, None, ate, self.fish_price, None, format!("Day {} ends. {} cats ate, {} alive.", day, ate, alive));
        self.day
    }

    // ------------------------------------------------------------------
    // NFT holder actions
    // ------------------------------------------------------------------

    /// The NFT holder takes the cat's profit (balance above stake). For a ghost cat, the holder
    /// inherits whatever is left. The right moves with the NFT: the previous holder keeps nothing.
    pub fn claim_profit(&mut self, token_id: TokenId) -> U128 {
        let owner = self.tokens.owner_by_id.get(&token_id).unwrap_or_else(|| env::panic_str("No such token"));
        require!(env::predecessor_account_id() == owner, "Only the NFT holder can claim");
        let id: u32 = token_id.parse().unwrap();
        let mut cat = self.cats.get(&id).cloned().unwrap();
        let amount = if cat.alive {
            yocto(cat.balance).saturating_sub(yocto(cat.stake))
        } else {
            yocto(cat.balance)
        };
        require!(amount > 0, "Nothing to claim");
        cat.balance = U128(yocto(cat.balance) - amount);
        cat.claimed = U128(yocto(cat.claimed) + amount);
        self.cats.insert(id, cat);
        self.push_event("claim", Some(id), None, None, 0, amount, None, owner.to_string());
        Promise::new(owner).transfer(NearToken::from_yoctonear(amount)).detach();
        U128(amount)
    }

    /// Anyone can top up a living cat's wallet. It increases the cat's stake.
    #[payable]
    pub fn feed(&mut self, token_id: TokenId) {
        let id: u32 = token_id.parse().unwrap_or_else(|_| env::panic_str("Bad token id"));
        let mut cat = self.cats.get(&id).cloned().unwrap_or_else(|| env::panic_str("No such cat"));
        require!(cat.alive, "Ghosts cannot eat");
        let d = env::attached_deposit().as_yoctonear();
        require!(d > 0, "Attach NEAR");
        cat.balance = U128(yocto(cat.balance) + d);
        cat.stake = U128(yocto(cat.stake) + d);
        self.cats.insert(id, cat);
        self.push_event("feed", Some(id), None, None, 0, d, None, env::predecessor_account_id().to_string());
    }

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------

    pub fn set_day_length(&mut self, day_length_ms: u64) {
        self.assert_admin();
        require!(day_length_ms >= 10_000, "Day too short");
        self.config.day_length_ms = day_length_ms;
        self.push_event("config", None, None, None, 0, 0, None, format!("day_length_ms={}", day_length_ms));
    }

    pub fn set_media_base(&mut self, media_base: String) {
        self.assert_admin();
        self.media_base = media_base;
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    pub fn get_state(&self) -> GameState {
        GameState {
            day: self.day,
            last_tick_ms: self.last_tick_ms,
            next_tick_ms: self.last_tick_ms + self.config.day_length_ms,
            now_ms: env::block_timestamp_ms(),
            fish_price: U128(self.fish_price),
            fish_sold_today: self.fish_sold_today,
            treasury: U128(self.treasury),
            cats: self.cats.len(),
            alive: self.cats.values().filter(|c| c.alive).count() as u32,
            open_offers: self.offers.len(),
            event_count: self.event_count,
            plots: self.plots.clone(),
            config: self.config.clone(),
            admin: self.admin.clone(),
        }
    }

    pub fn get_cats(&self) -> Vec<CatView> {
        self.cats.values().map(|c| self.cat_view(c)).collect()
    }

    pub fn get_cat(&self, cat_id: u32) -> Option<CatView> {
        self.cats.get(&cat_id).map(|c| self.cat_view(c))
    }

    pub fn get_cat_by_account(&self, account_id: AccountId) -> Option<CatView> {
        self.cat_by_account.get(&account_id).and_then(|id| self.get_cat(*id))
    }

    pub fn get_offers(&self) -> Vec<Offer> {
        self.offers.values().cloned().collect()
    }

    /// Events with id >= from_id (oldest first). Only the last 200 events are kept on-chain.
    pub fn get_events(&self, from_id: Option<u64>, limit: Option<u32>) -> Vec<GameEvent> {
        let limit = limit.unwrap_or(50).min(200) as u64;
        let oldest = self.event_count.saturating_sub(EVENT_CAP);
        let start = from_id.unwrap_or(oldest).max(oldest);
        (start..self.event_count)
            .take(limit as usize)
            .filter_map(|i| self.events.get((i % EVENT_CAP) as u32).cloned())
            .collect()
    }

    pub fn fish_quote(&self, qty: u32) -> U128 {
        let mut total = 0u128;
        let mut price = self.fish_price;
        let cap = yocto(self.config.fish_base_price) * 20;
        for _ in 0..qty.min(10) {
            total += price;
            price = (price * 105 / 100).min(cap);
        }
        U128(total)
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    fn assert_admin(&self) {
        require!(env::predecessor_account_id() == self.admin, "Admin only");
    }

    fn caller_cat(&self) -> Cat {
        let caller = env::predecessor_account_id();
        let id = self
            .cat_by_account
            .get(&caller)
            .unwrap_or_else(|| env::panic_str("Only a cat's own account can do this"));
        let cat = self.cats.get(id).cloned().unwrap();
        require!(cat.alive, "Ghost cats cannot act");
        cat
    }

    fn cat_view(&self, c: &Cat) -> CatView {
        CatView {
            cat: c.clone(),
            owner_id: self.tokens.owner_by_id.get(&c.id.to_string()),
            plots: self.plots.iter().filter(|p| p.owner == Some(c.id)).map(|p| p.id).collect(),
        }
    }

    fn set_last_words(&mut self, cat_id: u32, message: &str) {
        if message.is_empty() {
            return;
        }
        if let Some(mut cat) = self.cats.get(&cat_id).cloned() {
            cat.last_words = message.to_string();
            self.cats.insert(cat_id, cat);
        }
    }

    fn kill(&mut self, id: u32) {
        let mut cat = self.cats.get(&id).cloned().unwrap();
        cat.alive = false;
        cat.died_day = Some(self.day);
        let name = cat.name.clone();
        let account = cat.account_id.clone();
        self.cats.insert(id, cat);
        for plot in self.plots.iter_mut() {
            if plot.owner == Some(id) {
                plot.owner = None;
            }
        }
        let dead_offers: Vec<u64> = self
            .offers
            .values()
            .filter(|o| o.maker == id || o.to_cat == Some(id))
            .map(|o| o.id)
            .collect();
        for o in dead_offers {
            self.offers.remove(&o);
        }
        let token_id = id.to_string();
        if let Some(meta_map) = self.tokens.token_metadata_by_id.as_mut() {
            if let Some(mut meta) = meta_map.get(&token_id) {
                meta.title = Some(format!("Ghost of {} #{}", name, id));
                meta.updated_at = Some(env::block_timestamp_ms().to_string());
                meta.extra = Some(format!(
                    "{{\"account\":\"{}\",\"alive\":false,\"died_day\":{}}}",
                    account, self.day
                ));
                meta_map.insert(&token_id, &meta);
            }
        }
        self.push_event("death", Some(id), None, None, 0, 0, None, format!("{} starved and became a ghost", name));
    }

    #[allow(clippy::too_many_arguments)]
    fn push_event(
        &mut self,
        kind: &str,
        cat: Option<u32>,
        other: Option<u32>,
        item: Option<String>,
        qty: u32,
        price: u128,
        offer_id: Option<u64>,
        text: String,
    ) {
        let ev = GameEvent {
            id: self.event_count,
            day: self.day,
            ts_ms: env::block_timestamp_ms(),
            kind: kind.to_string(),
            cat,
            other,
            item,
            qty,
            price: U128(price),
            offer_id,
            text,
        };
        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"ninelives\",\"version\":\"1.0.0\",\"event\":\"{}\",\"data\":[{}]}}",
            kind,
            near_sdk::serde_json::to_string(&ev).unwrap()
        ));
        let slot = (self.event_count % EVENT_CAP) as u32;
        if self.events.len() < EVENT_CAP as u32 {
            self.events.push(ev);
        } else {
            self.events.set(slot, ev);
        }
        self.event_count += 1;
    }
}

fn item_name(i: ItemKind) -> String {
    match i {
        ItemKind::Fish => "fish".into(),
        ItemKind::Plot => "plot".into(),
    }
}

fn side_name(s: Side) -> &'static str {
    match s {
        Side::Sell => "sell",
        Side::Buy => "buy",
    }
}

// ----------------------------------------------------------------------
// NEP-171 / NEP-177 / NEP-181 standard interfaces
// ----------------------------------------------------------------------

#[near]
impl NonFungibleTokenCore for NineLives {
    #[payable]
    fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        self.tokens.nft_transfer(receiver_id, token_id, approval_id, memo)
    }

    #[payable]
    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        self.tokens.nft_transfer_call(receiver_id, token_id, approval_id, memo, msg)
    }

    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id)
    }
}

#[near]
impl NonFungibleTokenResolver for NineLives {
    #[private]
    fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: Option<HashMap<AccountId, u64>>,
    ) -> bool {
        self.tokens.nft_resolve_transfer(previous_owner_id, receiver_id, token_id, approved_account_ids)
    }
}

#[near]
impl NonFungibleTokenEnumeration for NineLives {
    fn nft_total_supply(&self) -> U128 {
        self.tokens.nft_total_supply()
    }

    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens.nft_tokens(from_index, limit)
    }

    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        self.tokens.nft_supply_for_owner(account_id)
    }

    fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<Token> {
        self.tokens.nft_tokens_for_owner(account_id, from_index, limit)
    }
}

#[near]
impl NonFungibleTokenMetadataProvider for NineLives {
    fn nft_metadata(&self) -> NFTContractMetadata {
        self.metadata.get().unwrap()
    }
}

#[cfg(test)]
mod tests;
