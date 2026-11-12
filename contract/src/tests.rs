use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;

const DAY_MS: u64 = 60_000;

fn admin() -> AccountId {
    "admin.testnet".parse().unwrap()
}
fn contract_id() -> AccountId {
    "ninelives.testnet".parse().unwrap()
}
fn alice() -> AccountId {
    "alice.testnet".parse().unwrap()
}
fn bob() -> AccountId {
    "bob.testnet".parse().unwrap()
}
fn cat_acc(id: u32) -> AccountId {
    format!("cat-{}.ninelives.testnet", id).parse().unwrap()
}
fn key() -> PublicKey {
    "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp".parse().unwrap()
}
fn near(milli: u128) -> u128 {
    NearToken::from_millinear(milli).as_yoctonear()
}

fn ctx(predecessor: AccountId, deposit: u128, now_ms: u64) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(contract_id())
        .predecessor_account_id(predecessor.clone())
        .signer_account_id(predecessor)
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .account_balance(NearToken::from_near(100))
        .block_timestamp(now_ms * 1_000_000);
    testing_env!(b.build());
}

fn setup(cats: u32) -> NineLives {
    ctx(admin(), 0, 1_000);
    // Luck is switched off so hunger timings are exact; `night_hunt_uses_luck` tests it.
    let config = Config { catch_chance_pct: 0, ..Default::default() };
    let mut c = NineLives::new(admin(), "https://ninelives.example".into(), Some(config));
    for i in 0..cats {
        ctx(admin(), near(500), 1_000);
        c.adopt(
            format!("Cat{}", i + 1),
            "shark".into(),
            "{}".into(),
            key(),
            Some(alice()),
        );
        // Simulate a successful account-creation callback.
        let mut cat = c.cats.get(&(i + 1)).unwrap().clone();
        cat.account_ready = true;
        c.cats.insert(i + 1, cat);
    }
    c
}

fn bal(c: &NineLives, id: u32) -> u128 {
    c.get_cat(id).unwrap().cat.balance.0
}
fn fish(c: &NineLives, id: u32) -> u32 {
    c.get_cat(id).unwrap().cat.fish
}

#[test]
fn adopt_mints_nft_and_sets_stake() {
    let c = setup(1);
    let v = c.get_cat(1).unwrap();
    assert_eq!(v.cat.account_id, cat_acc(1));
    assert_eq!(v.owner_id, Some(alice()));
    assert_eq!(v.cat.fish, 3);
    assert!(v.cat.alive);
    // stake = deposit - gas tank - storage, so a bit under 0.45 NEAR
    let stake = v.cat.stake.0;
    assert!(stake < near(450) && stake > near(440), "stake {}", stake);
    assert_eq!(v.cat.balance.0, stake);
    assert_eq!(c.nft_token("1".into()).unwrap().owner_id, alice());
}

#[test]
#[should_panic(expected = "Admin only")]
fn only_admin_can_adopt() {
    let mut c = setup(0);
    ctx(alice(), near(500), 1_000);
    c.adopt("X".into(), "shark".into(), "{}".into(), key(), None);
}

#[test]
#[should_panic(expected = "All nine lives are taken")]
fn only_nine_cats() {
    let mut c = setup(9);
    ctx(admin(), near(500), 1_000);
    c.adopt("Ten".into(), "shark".into(), "{}".into(), key(), None);
}

#[test]
#[should_panic(expected = "Attach at least")]
fn adopt_requires_deposit() {
    let mut c = setup(0);
    ctx(admin(), near(150), 1_000);
    c.adopt("Poor".into(), "shark".into(), "{}".into(), key(), None);
}

#[test]
#[should_panic(expected = "Only a cat's own account can do this")]
fn humans_cannot_trade_for_cats() {
    let mut c = setup(2);
    ctx(alice(), 0, 2_000);
    c.say("hi".into(), None);
}

#[test]
fn fish_trade_settles_atomically() {
    let mut c = setup(2);
    let (b1, b2) = (bal(&c, 1), bal(&c, 2));
    ctx(cat_acc(1), 0, 2_000);
    let offer = c.make_offer(Side::Sell, ItemKind::Fish, Some(2), None, U128(near(30)), None, None, Some("Fresh fish, 2 for 0.03".into()));
    ctx(cat_acc(2), 0, 3_000);
    c.accept_offer(offer, Some("Deal.".into()));
    assert_eq!(fish(&c, 1), 1);
    assert_eq!(fish(&c, 2), 5);
    assert_eq!(bal(&c, 1), b1 + near(30));
    assert_eq!(bal(&c, 2), b2 - near(30));
    assert!(c.get_offers().is_empty());
    assert_eq!(c.get_cat(2).unwrap().cat.last_words, "Deal.");
}

#[test]
fn buy_offer_is_filled_by_seller() {
    let mut c = setup(2);
    ctx(cat_acc(2), 0, 2_000);
    let offer = c.make_offer(Side::Buy, ItemKind::Fish, Some(1), None, U128(near(12)), None, None, None);
    ctx(cat_acc(1), 0, 3_000);
    c.accept_offer(offer, None);
    assert_eq!(fish(&c, 1), 2);
    assert_eq!(fish(&c, 2), 4);
}

#[test]
#[should_panic(expected = "This offer is for another cat")]
fn counter_offer_is_private() {
    let mut c = setup(3);
    ctx(cat_acc(1), 0, 2_000);
    let o = c.make_offer(Side::Sell, ItemKind::Fish, Some(1), None, U128(near(20)), Some(2), None, Some("Only for you".into()));
    ctx(cat_acc(3), 0, 3_000);
    c.accept_offer(o, None);
}

#[test]
#[should_panic(expected = "Seller does not have the fish")]
fn offer_fails_if_seller_ate_the_fish() {
    let mut c = setup(2);
    ctx(cat_acc(1), 0, 2_000);
    let o = c.make_offer(Side::Sell, ItemKind::Fish, Some(3), None, U128(near(20)), None, None, None);
    // A day passes and cat 1 eats one fish.
    ctx(admin(), 0, 1_000 + DAY_MS);
    c.tick();
    ctx(cat_acc(2), 0, 1_000 + DAY_MS + 1);
    c.accept_offer(o, None);
}

#[test]
fn shop_price_rises_with_demand_and_cools_down() {
    let mut c = setup(1);
    let p0 = c.get_state().fish_price.0;
    let quote = c.fish_quote(3);
    ctx(cat_acc(1), 0, 2_000);
    let paid = c.buy_fish(3, quote, None);
    assert_eq!(paid, quote);
    let p1 = c.get_state().fish_price.0;
    assert!(p1 > p0);
    assert_eq!(c.get_state().treasury, paid);
    ctx(admin(), 0, 1_000 + DAY_MS);
    c.tick();
    let p2 = c.get_state().fish_price.0;
    assert!(p2 < p1 && p2 >= p0);
}

#[test]
#[should_panic(expected = "Price moved above max_total")]
fn shop_respects_slippage_limit() {
    let mut c = setup(1);
    ctx(cat_acc(1), 0, 2_000);
    c.buy_fish(2, U128(near(5)), None);
}

#[test]
#[should_panic(expected = "The day is not over yet")]
fn tick_waits_for_the_day_to_end() {
    let mut c = setup(1);
    ctx(bob(), 0, 1_000 + DAY_MS - 1);
    c.tick();
}

#[test]
fn starving_cat_becomes_a_ghost() {
    let mut c = setup(2);
    // Cat 1 owns a plot, so we can check it is released on death.
    ctx(cat_acc(1), 0, 2_000);
    c.buy_plot(0, None);
    // Plot 0 produces 1 fish/day and cat 1 eats 1/day, so give cat 1's fish away to starve cat 2 instead.
    // Cat 2: 3 fish, eats 1 per day -> fish run out after day 3, then 3 hungry days -> dies on day 6.
    let mut now = 1_000;
    for _ in 0..5 {
        now += DAY_MS;
        ctx(bob(), 0, now);
        c.tick();
        assert!(c.get_cat(2).unwrap().cat.alive);
    }
    now += DAY_MS;
    ctx(bob(), 0, now);
    c.tick();
    let ghost = c.get_cat(2).unwrap().cat;
    assert!(!ghost.alive);
    assert_eq!(ghost.died_day, Some(6));
    let title = c.nft_token("2".into()).unwrap().metadata.unwrap().title.unwrap();
    assert!(title.starts_with("Ghost of"), "{}", title);
    // Cat 1 survives thanks to its plot.
    assert!(c.get_cat(1).unwrap().cat.alive);
    assert!(c.get_events(None, Some(200)).iter().any(|e| e.kind == "death" && e.cat == Some(2)));
}

#[test]
#[should_panic(expected = "Ghost cats cannot act")]
fn ghosts_cannot_act() {
    let mut c = setup(1);
    let mut now = 1_000;
    for _ in 0..6 {
        now += DAY_MS;
        ctx(bob(), 0, now);
        c.tick();
    }
    ctx(cat_acc(1), 0, now + 1);
    c.say("boo".into(), None);
}

#[test]
fn ghost_releases_its_plot() {
    let mut c = setup(1);
    ctx(cat_acc(1), 0, 2_000);
    c.buy_plot(3, None); // 2 fish/day: the cat would never starve, so kill it directly.
    c.kill(1);
    assert_eq!(c.get_state().plots[3].owner, None);
}

#[test]
fn plots_produce_fish_and_fish_rot_above_cap() {
    let mut c = setup(1);
    ctx(cat_acc(1), 0, 2_000);
    c.buy_plot(3, None); // Warm Laptop: 2 fish/day
    let mut now = 1_000;
    for _ in 0..12 {
        now += DAY_MS;
        ctx(bob(), 0, now);
        c.tick();
    }
    // +2 produced, capped at 10, -1 eaten per day: settles at 9.
    assert_eq!(fish(&c, 1), 9);
    assert!(c.get_events(None, Some(200)).iter().any(|e| e.kind == "rot"));
}

#[test]
fn plot_changes_hands_through_an_offer() {
    let mut c = setup(2);
    ctx(cat_acc(1), 0, 2_000);
    c.buy_plot(4, None);
    let o = c.make_offer(Side::Sell, ItemKind::Plot, None, Some(4), U128(near(200)), None, None, Some("Best roof in town".into()));
    ctx(cat_acc(2), 0, 3_000);
    c.accept_offer(o, None);
    assert_eq!(c.get_state().plots[4].owner, Some(2));
    assert_eq!(c.get_cat(2).unwrap().plots, vec![4]);
}

#[test]
fn profit_follows_the_nft() {
    let mut c = setup(2);
    // Cat 1 sells fish to cat 2 at a profit.
    ctx(cat_acc(1), 0, 2_000);
    let o = c.make_offer(Side::Sell, ItemKind::Fish, Some(2), None, U128(near(50)), None, None, None);
    ctx(cat_acc(2), 0, 3_000);
    c.accept_offer(o, None);

    // Alice sells the NFT of cat 1 to Bob.
    ctx(alice(), 1, 4_000);
    c.nft_transfer(bob(), "1".into(), None, None);

    // Bob, the new holder, gets the profit. The stake stays with the cat.
    ctx(bob(), 0, 5_000);
    let got = c.claim_profit("1".into());
    assert_eq!(got.0, near(50));
    let cat = c.get_cat(1).unwrap().cat;
    assert_eq!(cat.balance, cat.stake);
    assert_eq!(cat.claimed.0, near(50));
}

#[test]
#[should_panic(expected = "Only the NFT holder can claim")]
fn previous_holder_keeps_nothing() {
    let mut c = setup(1);
    ctx(alice(), 1, 4_000);
    c.nft_transfer(bob(), "1".into(), None, None);
    ctx(alice(), 0, 5_000);
    c.claim_profit("1".into());
}

#[test]
fn feed_increases_stake() {
    let mut c = setup(1);
    let before = c.get_cat(1).unwrap().cat;
    ctx(bob(), near(100), 2_000);
    c.feed("1".into());
    let after = c.get_cat(1).unwrap().cat;
    assert_eq!(after.balance.0, before.balance.0 + near(100));
    assert_eq!(after.stake.0, before.stake.0 + near(100));
}

#[test]
fn offers_expire() {
    let mut c = setup(2);
    ctx(cat_acc(1), 0, 2_000);
    c.make_offer(Side::Sell, ItemKind::Fish, Some(1), None, U128(near(20)), None, None, None);
    let mut now = 1_000;
    for _ in 0..2 {
        now += DAY_MS;
        ctx(bob(), 0, now);
        c.tick();
    }
    assert!(c.get_offers().is_empty());
}

#[test]
fn event_log_is_a_bounded_ring() {
    let mut c = setup(1);
    for i in 0..250 {
        ctx(cat_acc(1), 0, 2_000 + i as u64);
        c.say(format!("meow {}", i), None);
    }
    let evs = c.get_events(None, Some(200));
    assert_eq!(evs.len(), 200);
    assert_eq!(evs.last().unwrap().text, "meow 249");
    assert_eq!(evs.first().unwrap().id, c.get_state().event_count - 200);
    let tail = c.get_events(Some(c.get_state().event_count - 3), None);
    assert_eq!(tail.len(), 3);
}

#[test]
fn night_hunt_uses_luck() {
    let mut c = setup(3);
    let mut cfg = c.get_state().config;
    cfg.catch_chance_pct = 100;
    ctx(admin(), 0, 2_000);
    c.set_config(cfg);
    ctx(bob(), 0, 1_000 + DAY_MS);
    c.tick();
    // Everyone caught one fish and ate one: still 3 fish each.
    for id in 1..=3 {
        assert_eq!(fish(&c, id), 3);
    }
    assert_eq!(c.get_events(None, Some(200)).iter().filter(|e| e.kind == "catch").count(), 3);
}

#[test]
#[should_panic(expected = "Admin only")]
fn only_admin_can_change_config() {
    let mut c = setup(1);
    let cfg = c.get_state().config;
    ctx(alice(), 0, 2_000);
    c.set_config(cfg);
}

#[test]
fn excess_fish_feed_an_empty_bowl() {
    let mut c = setup(2);
    let mut rich = c.cats.get(&1).unwrap().clone();
    rich.fish = 20;
    c.cats.insert(1, rich);
    let mut poor = c.cats.get(&2).unwrap().clone();
    poor.fish = 0;
    poor.hunger = 2;
    c.cats.insert(2, poor);
    ctx(bob(), 0, 1_000 + DAY_MS);
    c.tick();
    // 10 fish over the cap: 5 spoil, 1 lands in cat 2's empty bowl, the rest rot. Cat 2 eats it and survives.
    let poor = c.get_cat(2).unwrap().cat;
    assert!(poor.alive);
    assert_eq!(poor.hunger, 0);
    assert_eq!(fish(&c, 1), 9);
    let evs = c.get_events(None, Some(200));
    assert!(evs.iter().any(|e| e.kind == "scraps" && e.cat == Some(2) && e.other == Some(1)));
    assert!(evs.iter().any(|e| e.kind == "rot" && e.qty == 9));
}

#[test]
fn media_base_moves_existing_nft_images() {
    let mut c = setup(2);
    ctx(admin(), 0, 2_000);
    c.set_media_base("https://alley.example/".into());
    let media = c.nft_token("2".into()).unwrap().metadata.unwrap().media.unwrap();
    assert_eq!(media, "https://alley.example/api/cat/2/image");
}

// ---------------------------------------------------------------- marketplace

#[test]
fn holder_lists_and_anyone_buys() {
    let mut c = setup(2);
    ctx(alice(), 0, 2_000);
    c.list_cat("2".into(), U128(near(500)));
    assert_eq!(c.get_listings().len(), 1);
    assert_eq!(c.get_listings()[0].seller, alice());
    // Bob (or Bob's AI agent) buys it, overpaying a little.
    ctx(bob(), near(600), 3_000);
    let new_owner = c.buy_cat("2".into());
    assert_eq!(new_owner, bob());
    assert_eq!(c.nft_token("2".into()).unwrap().owner_id, bob());
    assert!(c.get_listings().is_empty());
    assert!(c.get_events(None, Some(200)).iter().any(|e| e.kind == "sale" && e.cat == Some(2) && e.price.0 == near(500)));
}

#[test]
#[should_panic(expected = "Only the NFT holder can list it")]
fn only_holder_can_list() {
    let mut c = setup(1);
    ctx(bob(), 0, 2_000);
    c.list_cat("1".into(), U128(near(500)));
}

#[test]
#[should_panic(expected = "Attach at least")]
fn buying_needs_the_full_price() {
    let mut c = setup(1);
    ctx(alice(), 0, 2_000);
    c.list_cat("1".into(), U128(near(500)));
    ctx(bob(), near(499), 3_000);
    c.buy_cat("1".into());
}

#[test]
#[should_panic(expected = "This cat is not for sale")]
fn a_private_transfer_cancels_the_sale() {
    let mut c = setup(1);
    ctx(alice(), 0, 2_000);
    c.list_cat("1".into(), U128(near(500)));
    ctx(alice(), 1, 3_000);
    c.nft_transfer(bob(), "1".into(), None, None);
    ctx(admin(), near(500), 4_000);
    c.buy_cat("1".into());
}

#[test]
fn holder_can_delist() {
    let mut c = setup(1);
    ctx(alice(), 0, 2_000);
    c.list_cat("1".into(), U128(near(500)));
    c.delist_cat("1".into());
    assert!(c.get_listings().is_empty());
}

#[test]
fn a_ghost_can_be_sold_as_a_collectible() {
    let mut c = setup(1);
    c.kill(1);
    ctx(alice(), 0, 2_000);
    c.list_cat("1".into(), U128(near(20)));
    assert!(!c.get_listings()[0].alive);
    ctx(bob(), near(20), 3_000);
    c.buy_cat("1".into());
    assert_eq!(c.nft_token("1".into()).unwrap().owner_id, bob());
}

// ---------------------------------------------------------------- fan clubs

fn carol() -> AccountId {
    "carol.testnet".parse().unwrap()
}

#[test]
fn fans_take_seats_and_half_feeds_the_cat() {
    let mut c = setup(2);
    let before = bal(&c, 1);
    ctx(bob(), near(10), 2_000);
    assert_eq!(c.join_fan_club(0), 1);
    let homes = c.get_homes();
    assert_eq!(homes[0].fans, 1);
    assert_eq!(homes[0].resident, 1);
    let to_cat = bal(&c, 1) - before;
    let saved = homes[0].nursery.0;
    // Storage is paid first, the rest is split between the cat and the nursery.
    assert!(to_cat > near(3) && to_cat <= near(5), "to cat {}", to_cat);
    assert!(saved >= to_cat && saved - to_cat <= 1);
    assert_eq!(c.get_cat(1).unwrap().cat.stake.0, bal(&c, 1));
    assert_eq!(c.get_fans(0, None, None), vec![bob()]);
    assert_eq!(c.get_state().fans, 1);
    assert_eq!(c.get_state().fan_seats, 3150);
}

#[test]
#[should_panic(expected = "You already have a seat in this fan club")]
fn one_seat_per_wallet_per_home() {
    let mut c = setup(1);
    ctx(bob(), near(10), 2_000);
    c.join_fan_club(0);
    ctx(bob(), near(10), 3_000);
    c.join_fan_club(0);
}

#[test]
#[should_panic(expected = "Attach 0.01 NEAR for a seat")]
fn a_seat_costs_a_hundredth_of_a_near() {
    let mut c = setup(1);
    ctx(bob(), near(5), 2_000);
    c.join_fan_club(0);
}

#[test]
#[should_panic(expected = "This fan club is full")]
fn fan_club_has_350_seats() {
    let mut c = setup(1);
    for i in 0..SEATS_PER_HOME {
        let fan: AccountId = format!("fan{}.testnet", i).parse().unwrap();
        ctx(fan, near(10), 2_000);
        c.join_fan_club(3);
    }
    assert_eq!(c.get_homes()[3].fans, SEATS_PER_HOME);
    ctx(bob(), near(10), 3_000);
    c.join_fan_club(3);
}

#[test]
fn fans_earn_a_cut_of_profit_claims() {
    let mut c = setup(2);
    ctx(bob(), near(10), 1_500);
    c.join_fan_club(0);
    ctx(carol(), near(10), 1_600);
    c.join_fan_club(0);
    // Cat 1 makes 50 mN of profit.
    ctx(cat_acc(1), 0, 2_000);
    let o = c.make_offer(Side::Sell, ItemKind::Fish, Some(2), None, U128(near(50)), None, None, None);
    ctx(cat_acc(2), 0, 3_000);
    c.accept_offer(o, None);
    ctx(alice(), 0, 4_000);
    let got = c.claim_profit("1".into());
    assert_eq!(got.0, near(35));
    let seats = c.get_fan_seats(bob());
    assert_eq!(seats.len(), 1);
    assert_eq!(seats[0].pending.0, near(15) / 2);
    ctx(bob(), 0, 5_000);
    assert_eq!(c.claim_fan_rewards(0).0, near(15) / 2);
    assert_eq!(c.get_fan_seats(bob())[0].pending.0, 0);
    // A fan who joins later does not get earlier rewards.
    ctx(admin(), near(10), 6_000);
    c.join_fan_club(0);
    assert_eq!(c.get_fan_seats(admin())[0].pending.0, 0);
}

// ---------------------------------------------------------------- nine lives

fn starve(c: &mut NineLives, mut now: u64, days: u32) -> u64 {
    for _ in 0..days {
        now += DAY_MS;
        ctx(bob(), 0, now);
        c.tick();
    }
    now
}

fn register_keys(c: &mut NineLives, from: u32, to: u32) {
    ctx(admin(), 0, 1_500);
    c.register_brain_keys((from..=to).map(|i| (i, key())).collect());
}

#[test]
fn a_kitten_is_born_in_a_dark_home() {
    let mut c = setup(2);
    register_keys(&mut c, 3, 20);
    ctx(admin(), 0, 1_600);
    c.treasury = near(1000);
    // Cat 1 owns a plot and stays alive; cat 2 starves on day 6.
    ctx(cat_acc(1), 0, 2_000);
    c.buy_plot(0, None);
    let mut now = starve(&mut c, 1_000, 6);
    assert!(!c.get_cat(2).unwrap().cat.alive);
    assert!(c.get_cat(3).is_none(), "no birth on the night of the death");
    now = starve(&mut c, now, 1);
    let kitten = c.get_cat(3).expect("a kitten is born the next night");
    assert!(kitten.cat.alive);
    assert_eq!(kitten.home, 1);
    assert_eq!(kitten.life, 2);
    assert_eq!(kitten.generation, 2);
    assert_eq!(kitten.parent, Some(1), "the parent is the wealthiest living cat");
    assert_eq!(kitten.cat.account_id, cat_acc(3));
    assert_eq!(kitten.cat.personality, "shark");
    assert!(kitten.cat.stake.0 >= near(100), "stake {}", kitten.cat.stake.0);
    // The kitten NFT belongs to the nursery and is up for adoption.
    assert_eq!(c.nft_token("3".into()).unwrap().owner_id, contract_id());
    let l = c.get_listings();
    assert!(l.iter().any(|x| x.cat_id == 3 && x.price.0 == near(100)));
    let home = &c.get_homes()[1];
    assert_eq!(home.resident, 3);
    assert_eq!(home.lives_used, 2);
    assert_eq!(home.lives_left, 7);
    assert_eq!(home.cats, vec![2, 3]);
    assert!(c.get_events(None, Some(200)).iter().any(|e| e.kind == "born" && e.cat == Some(3) && e.other == Some(1)));
    assert!(c.treasury < near(1000));
    // Only one kitten per night, and the home is now taken.
    starve(&mut c, now, 1);
    assert!(c.get_cat(4).is_none());
}

#[test]
fn no_birth_without_a_brain_key_or_money() {
    let mut c = setup(1);
    let now = starve(&mut c, 1_000, 8);
    assert!(c.get_cat(2).is_none(), "no key registered");
    register_keys(&mut c, 2, 5);
    c.treasury = 0;
    let now = starve(&mut c, now, 2);
    assert!(c.get_cat(2).is_none(), "no money");
    // A donation to the nursery pays for the kitten.
    ctx(carol(), near(300), now + 1);
    c.donate_nursery(0);
    starve(&mut c, now, 1);
    let k = c.get_cat(2).expect("born with nursery money");
    assert!(k.cat.stake.0 > near(150), "the whole nursery goes to the kitten");
    assert_eq!(k.parent, Some(1), "with every cat dead, the home's last cat is the parent");
    assert_eq!(c.get_homes()[0].nursery.0, 0);
}

#[test]
fn a_home_has_nine_lives() {
    let mut c = setup(1);
    register_keys(&mut c, 2, 30);
    c.treasury = near(10_000);
    let mut now = 1_000;
    for _ in 0..100 {
        now = starve(&mut c, now, 1);
    }
    let h = &c.get_homes()[0];
    assert_eq!(h.lives_used, 9);
    assert_eq!(h.lives_left, 0);
    assert_eq!(h.cats.len(), 9);
    // The ninth cat starves too and nobody is born after it.
    for _ in 0..20 {
        now = starve(&mut c, now, 1);
    }
    assert!(!c.get_cat(h.resident).unwrap().cat.alive);
    assert_eq!(c.get_cats().len(), 9);
    assert_eq!(c.get_state().lives_used, 9 + 8);
}

#[test]
fn adopting_a_kitten_pays_its_home() {
    let mut c = setup(2);
    register_keys(&mut c, 3, 5);
    c.treasury = near(1000);
    ctx(bob(), near(10), 1_700);
    c.join_fan_club(1);
    ctx(cat_acc(1), 0, 2_000);
    c.buy_plot(0, None);
    starve(&mut c, 1_000, 7);
    assert!(c.get_cat(3).is_some());
    let nursery_before = c.get_homes()[1].nursery.0;
    ctx(carol(), near(100), 900_000);
    c.buy_cat("3".into());
    assert_eq!(c.nft_token("3".into()).unwrap().owner_id, carol());
    assert_eq!(c.get_homes()[1].nursery.0 - nursery_before, near(50));
    assert_eq!(c.get_fan_seats(bob())[0].pending.0, near(50));
}

#[test]
fn mutations_stay_in_range() {
    let parent = r#"{"risk":0.95,"lossAversion":0.9,"greed":0,"bluff":0.2,"patience":0.2,"generosity":0.2,"herding":0.6,"safetyStock":1,"endowment":1,"activity":1}"#;
    for i in 0..200u32 {
        let rnd = env::sha256(&i.to_le_bytes());
        let (t, _) = mutate_traits(parent, &rnd);
        let v: near_sdk::serde_json::Value = near_sdk::serde_json::from_str(&t).unwrap();
        for k in ["risk", "greed", "bluff", "patience", "generosity", "herding"] {
            let x = v[k].as_f64().unwrap();
            assert!((0.0..=1.0).contains(&x), "{} {}", k, x);
        }
        let la = v["lossAversion"].as_f64().unwrap();
        assert!((0.5..=3.5).contains(&la));
        let a = v["activity"].as_f64().unwrap();
        assert!((0.2..=1.0).contains(&a));
        let s = v["safetyStock"].as_f64().unwrap();
        assert!((0.0..=8.0).contains(&s) && s.fract() == 0.0);
    }
    // Not every kitten is a clone.
    let (a, _) = mutate_traits(parent, &env::sha256(b"x"));
    assert_ne!(a, parent);
    assert_eq!(mutate_traits("not json", &[1, 2, 3]).0, "not json");
}
