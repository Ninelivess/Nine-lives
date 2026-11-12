// yoctoNEAR strings <-> milliNEAR numbers. 1 mN = 0.001 NEAR = 10^21 yocto.
const YOCTO_PER_NANO_MN = 10n ** 15n; // 1e21 / 1e6

export function yoctoToMilli(yocto: string | bigint): number {
  return Number(BigInt(yocto) / YOCTO_PER_NANO_MN) / 1e6;
}

export function milliToYocto(mN: number): string {
  return (BigInt(Math.round(mN * 1e6)) * YOCTO_PER_NANO_MN).toString();
}
