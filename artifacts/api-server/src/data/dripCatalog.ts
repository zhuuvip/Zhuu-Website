export type DripCatalogVariant = {
  id: number;
  duration: string;
  modal: number;
  resellerPrice: number;
  memberPrice: number;
};

export type DripCatalogProduct = {
  name: string;
  variants: DripCatalogVariant[];
};

export const DRIP_CATALOG: DripCatalogProduct[] = [
  {
    name: "HG CHEAT BRUTAL VERSION MOD",
    variants: [
      { id: 5, duration: "1 Day", modal: 3560, resellerPrice: 8000, memberPrice: 10000 },
      { id: 135, duration: "7 Day", modal: 10680, resellerPrice: 21000, memberPrice: 26000 },
      { id: 6, duration: "10 Days", modal: 13350, resellerPrice: 26000, memberPrice: 32000 },
      { id: 7, duration: "30 Days", modal: 23852, resellerPrice: 44000, memberPrice: 52000 },
    ],
  },
  {
    name: "DRIP MOD APK",
    variants: [
      { id: 9, duration: "1 Day", modal: 1958, resellerPrice: 6000, memberPrice: 8000 },
      { id: 76, duration: "3 Day", modal: 4272, resellerPrice: 8000, memberPrice: 10000 },
      { id: 10, duration: "7 Day", modal: 12460, resellerPrice: 23000, memberPrice: 28000 },
      { id: 11, duration: "15 Day", modal: 22606, resellerPrice: 39000, memberPrice: 47000 },
      { id: 12, duration: "30 Day", modal: 24920, resellerPrice: 45000, memberPrice: 53000 },
    ],
  },
  {
    name: "Fluriote FF IOS",
    variants: [
      { id: 22, duration: "1Day", modal: 35600, resellerPrice: 40000, memberPrice: 49000 },
      { id: 23, duration: "7 Day", modal: 89000, resellerPrice: 99000, memberPrice: 104000 },
      { id: 24, duration: "30 Day", modal: 160200, resellerPrice: 181000, memberPrice: 189000 },
    ],
  },
  {
    name: "Fluriote MLBB IOS",
    variants: [
      { id: 25, duration: "1Day", modal: 35600, resellerPrice: 40000, memberPrice: 49000 },
      { id: 26, duration: "7 Day", modal: 89000, resellerPrice: 99000, memberPrice: 104000 },
      { id: 27, duration: "30 Day", modal: 160200, resellerPrice: 181000, memberPrice: 189000 },
    ],
  },
  {
    name: "Gbox Esgin Cert",
    variants: [
      { id: 8, duration: "Certificate 1 Yers", modal: 33820, resellerPrice: 38000, memberPrice: 47000 },
    ],
  },
  {
    name: "Haxxcker Pro Root",
    variants: [
      { id: 39, duration: "10 Day", modal: 80100, resellerPrice: 93000, memberPrice: 99000 },
    ],
  },
  {
    name: "Pubg Zolo Android",
    variants: [
      { id: 51, duration: "1Day", modal: 26700, resellerPrice: 31000, memberPrice: 38000 },
      { id: 52, duration: "7 Day", modal: 89000, resellerPrice: 99000, memberPrice: 104000 },
      { id: 53, duration: "30 Day", modal: 213600, resellerPrice: 234000, memberPrice: 242000 },
    ],
  },
  {
    name: "PATO ORANGE APKMOD",
    variants: [
      { id: 91, duration: "1 Day", modal: 14240, resellerPrice: 18000, memberPrice: 23000 },
      { id: 65, duration: "3Day", modal: 14240, resellerPrice: 18000, memberPrice: 23000 },
      { id: 66, duration: "7 Day", modal: 24920, resellerPrice: 35000, memberPrice: 40000 },
      { id: 68, duration: "15 Day", modal: 32040, resellerPrice: 49000, memberPrice: 57000 },
      { id: 69, duration: "31 Day", modal: 48060, resellerPrice: 52000, memberPrice: 62000 },
    ],
  },
  {
    name: "Fluriote 8BP IOS",
    variants: [
      { id: 88, duration: "1 Day", modal: 35600, resellerPrice: 40000, memberPrice: 49000 },
      { id: 89, duration: "7 Day", modal: 89000, resellerPrice: 99000, memberPrice: 104000 },
      { id: 90, duration: "30 Day", modal: 160200, resellerPrice: 181000, memberPrice: 189000 },
    ],
  },
  {
    name: "DRIP PROXY APKMOD",
    variants: [
      { id: 107, duration: "1 Day", modal: 1958, resellerPrice: 6000, memberPrice: 8000 },
      { id: 108, duration: "3 Day", modal: 4272, resellerPrice: 8000, memberPrice: 10000 },
      { id: 109, duration: "7 Day", modal: 12460, resellerPrice: 23000, memberPrice: 28000 },
      { id: 110, duration: "30 Day", modal: 22428, resellerPrice: 43000, memberPrice: 51000 },
    ],
  },
  {
    name: "MIGUL - MONITE IOS [ BASIC:",
    variants: [
      { id: 111, duration: "1 Days", modal: 10680, resellerPrice: 15000, memberPrice: 19000 },
      { id: 113, duration: "7 Day", modal: 35600, resellerPrice: 46000, memberPrice: 51000 },
      { id: 114, duration: "30 Day", modal: 62300, resellerPrice: 83000, memberPrice: 91000 },
    ],
  },
  {
    name: "MIGUL - MONITE IOS [ PRO ]:",
    variants: [
      { id: 112, duration: "1Day", modal: 12460, resellerPrice: 16000, memberPrice: 21000 },
      { id: 115, duration: "7 Day", modal: 39160, resellerPrice: 50000, memberPrice: 55000 },
      { id: 116, duration: "30 Day", modal: 67640, resellerPrice: 88000, memberPrice: 96000 },
    ],
  },
  {
    name: "HG CHEATS PROXY APKMOD",
    variants: [
      { id: 120, duration: "1 Days", modal: 5340, resellerPrice: 9000, memberPrice: 14000 },
      { id: 132, duration: "7Day", modal: 13350, resellerPrice: 24000, memberPrice: 29000 },
      { id: 133, duration: "10 Days", modal: 16020, resellerPrice: 29000, memberPrice: 35000 },
      { id: 134, duration: "30 Days", modal: 42720, resellerPrice: 63000, memberPrice: 71000 },
    ],
  },
  {
    name: "HAXXCKER PRO ROOT",
    variants: [
      { id: 121, duration: "10 Days", modal: 39160, resellerPrice: 52000, memberPrice: 58000 },
    ],
  },
  {
    name: "SILENT CHEATS APKMOD",
    variants: [
      { id: 123, duration: "1 Day", modal: 4628, resellerPrice: 9000, memberPrice: 11000 },
      { id: 124, duration: "3 Day", modal: 12460, resellerPrice: 16000, memberPrice: 21000 },
      { id: 125, duration: "7 Day", modal: 21360, resellerPrice: 32000, memberPrice: 37000 },
      { id: 126, duration: "14 Days", modal: 42720, resellerPrice: 59000, memberPrice: 67000 },
      { id: 127, duration: "28 Days", modal: 85440, resellerPrice: 106000, memberPrice: 115000 },
    ],
  },
  {
    name: "RAPID CORE FF ROOT",
    variants: [
      { id: 128, duration: "1 Days", modal: 890, resellerPrice: 5000, memberPrice: 7000 },
      { id: 129, duration: "7 Daya", modal: 7120, resellerPrice: 18000, memberPrice: 23000 },
      { id: 130, duration: "14 Days", modal: 8900, resellerPrice: 25000, memberPrice: 33000 },
      { id: 131, duration: "30 Days", modal: 17800, resellerPrice: 38000, memberPrice: 46000 },
    ],
  },
  {
    name: "BALAMOD ANDROID APKMOD",
    variants: [
      { id: 148, duration: "1 Hour", modal: 1068, resellerPrice: 5000, memberPrice: 7000 },
      { id: 153, duration: "3 Hours", modal: 3204, resellerPrice: 7000, memberPrice: 9000 },
      { id: 149, duration: "6 Hours", modal: 6408, resellerPrice: 10000, memberPrice: 15000 },
      { id: 154, duration: "12 Hours", modal: 12816, resellerPrice: 17000, memberPrice: 21000 },
      { id: 150, duration: "24 Hours (1 Day)", modal: 25810, resellerPrice: 30000, memberPrice: 37000 },
      { id: 151, duration: "48 Hours (2 Days)", modal: 51620, resellerPrice: 56000, memberPrice: 68000 },
      { id: 155, duration: "72 Hours (3 Days)", modal: 71200, resellerPrice: 75000, memberPrice: 88000 },
      { id: 152, duration: "168 Hours (7 Days)", modal: 172660, resellerPrice: 183000, memberPrice: 188000 },
    ],
  },
  {
    name: "ABCD PANELL NO ROOT",
    variants: [
      { id: 160, duration: "12 Hours", modal: 6942, resellerPrice: 11000, memberPrice: 15000 },
      { id: 157, duration: "1 Days", modal: 12282, resellerPrice: 16000, memberPrice: 21000 },
      { id: 158, duration: "3 Days", modal: 26522, resellerPrice: 31000, memberPrice: 38000 },
      { id: 159, duration: "7 Days", modal: 35422, resellerPrice: 46000, memberPrice: 51000 },
    ],
  },
  {
    name: "XREG NO ROOT MOD APK",
    variants: [
      { id: 162, duration: "1 Hour", modal: 1068, resellerPrice: 5000, memberPrice: 7000 },
      { id: 164, duration: "3 Hours", modal: 2314, resellerPrice: 6000, memberPrice: 8000 },
      { id: 168, duration: "6 Hours", modal: 4272, resellerPrice: 8000, memberPrice: 10000 },
      { id: 167, duration: "12 Hours", modal: 5162, resellerPrice: 9000, memberPrice: 14000 },
      { id: 163, duration: "1 Day", modal: 7654, resellerPrice: 12000, memberPrice: 16000 },
      { id: 165, duration: "3 Days", modal: 16020, resellerPrice: 20000, memberPrice: 28000 },
      { id: 166, duration: "7 Days", modal: 24920, resellerPrice: 35000, memberPrice: 40000 },
      { id: 172, duration: "30 Days", modal: 89000, resellerPrice: 109000, memberPrice: 117000 },
    ],
  },
  {
    name: "ANGRY MOD ROOT FF",
    variants: [
      { id: 173, duration: "1 Days", modal: 5340, resellerPrice: 9000, memberPrice: 14000 },
      { id: 174, duration: "7 Days", modal: 17800, resellerPrice: 28000, memberPrice: 33000 },
      { id: 175, duration: "15 Days", modal: 26700, resellerPrice: 43000, memberPrice: 51000 },
      { id: 176, duration: "30 Days", modal: 44500, resellerPrice: 65000, memberPrice: 73000 },
    ],
  },
  {
    name: "HG PRIME PROXY",
    variants: [
      { id: 177, duration: "1 Days", modal: 3560, resellerPrice: 8000, memberPrice: 10000 },
      { id: 178, duration: "7 Days", modal: 10502, resellerPrice: 21000, memberPrice: 26000 },
      { id: 179, duration: "10 Days", modal: 16020, resellerPrice: 29000, memberPrice: 35000 },
    ],
  },
  {
    name: "DRIP WIRE ANDROID +IOS",
    variants: [
      { id: 182, duration: "6 Hours", modal: 2136, resellerPrice: 6000, memberPrice: 8000 },
      { id: 184, duration: "12 Hours", modal: 4806, resellerPrice: 9000, memberPrice: 11000 },
      { id: 181, duration: "1 Day", modal: 7120, resellerPrice: 11000, memberPrice: 16000 },
      { id: 183, duration: "7 Days", modal: 17800, resellerPrice: 28000, memberPrice: 33000 },
    ],
  },
  {
    name: "AIM HACK ANDROID+ IOS",
    variants: [
      { id: 185, duration: "1 Hour", modal: 1068, resellerPrice: 5000, memberPrice: 7000 },
      { id: 187, duration: "3 Hours", modal: 2314, resellerPrice: 6000, memberPrice: 8000 },
      { id: 189, duration: "6 Hours", modal: 4272, resellerPrice: 8000, memberPrice: 10000 },
      { id: 191, duration: "12 Hours", modal: 5162, resellerPrice: 9000, memberPrice: 14000 },
      { id: 186, duration: "1 Day", modal: 7654, resellerPrice: 12000, memberPrice: 16000 },
      { id: 188, duration: "3 Days", modal: 16020, resellerPrice: 20000, memberPrice: 28000 },
      { id: 190, duration: "7 Days", modal: 24920, resellerPrice: 35000, memberPrice: 40000 },
      { id: 192, duration: "30 Days", modal: 89000, resellerPrice: 109000, memberPrice: 117000 },
    ],
  },
  {
    name: "HG CHEAT SAFE VERSION MOD",
    variants: [
      { id: 193, duration: "1 Days", modal: 3560, resellerPrice: 8000, memberPrice: 10000 },
      { id: 204, duration: "7 Day", modal: 10680, resellerPrice: 21000, memberPrice: 26000 },
      { id: 194, duration: "10 Days", modal: 13350, resellerPrice: 26000, memberPrice: 32000 },
      { id: 205, duration: "30 Day", modal: 23852, resellerPrice: 44000, memberPrice: 52000 },
    ],
  },
  {
    name: "SILENT CHEAT PROXY AIMKILL",
    variants: [
      { id: 195, duration: "1 Hours", modal: 1068, resellerPrice: 5000, memberPrice: 7000 },
      { id: 196, duration: "3 Hours", modal: 2314, resellerPrice: 6000, memberPrice: 8000 },
      { id: 197, duration: "6 HOURS", modal: 4272, resellerPrice: 8000, memberPrice: 10000 },
      { id: 198, duration: "12 HOURS", modal: 5162, resellerPrice: 9000, memberPrice: 14000 },
      { id: 199, duration: "1 Days", modal: 7654, resellerPrice: 12000, memberPrice: 16000 },
      { id: 200, duration: "3 Days", modal: 16020, resellerPrice: 20000, memberPrice: 28000 },
      { id: 201, duration: "7 Days", modal: 23140, resellerPrice: 34000, memberPrice: 39000 },
      { id: 202, duration: "14 Days", modal: 44500, resellerPrice: 61000, memberPrice: 69000 },
      { id: 203, duration: "28 Days", modal: 71200, resellerPrice: 92000, memberPrice: 101000 },
    ],
  },
  {
    name: "VELORA IOS",
    variants: [
      { id: 206, duration: "1 Days", modal: 10680, resellerPrice: 15000, memberPrice: 19000 },
      { id: 207, duration: "3 Days", modal: 23674, resellerPrice: 28000, memberPrice: 35000 },
      { id: 208, duration: "7 Days", modal: 35600, resellerPrice: 46000, memberPrice: 51000 },
      { id: 209, duration: "15 Days", modal: 47526, resellerPrice: 64000, memberPrice: 72000 },
      { id: 210, duration: "30 Days", modal: 59274, resellerPrice: 80000, memberPrice: 88000 },
    ],
  },
  {
    name: "DRIP MOBILE ROOT",
    variants: [
      { id: 13, duration: "1 Day", modal: 1958, resellerPrice: 6000, memberPrice: 8000 },
      { id: 14, duration: "7 Day", modal: 12460, resellerPrice: 23000, memberPrice: 28000 },
      { id: 15, duration: "30 Day", modal: 24920, resellerPrice: 45000, memberPrice: 53000 },
    ],
  },
  {
    name: "DRIP 8BP APKMOD",
    variants: [
      { id: 87, duration: "1 Day", modal: 8010, resellerPrice: 12000, memberPrice: 17000 },
      { id: 30, duration: "7 Day", modal: 26700, resellerPrice: 37000, memberPrice: 42000 },
      { id: 31, duration: "30 Day", modal: 53400, resellerPrice: 74000, memberPrice: 82000 },
    ],
  },
  {
    name: "Prime Hook Apk Mod",
    variants: [
      { id: 84, duration: "1 Day", modal: 8900, resellerPrice: 13000, memberPrice: 17000 },
      { id: 85, duration: "3 Day", modal: 17800, resellerPrice: 22000, memberPrice: 29000 },
      { id: 86, duration: "7 Day", modal: 26700, resellerPrice: 37000, memberPrice: 42000 },
      { id: 34, duration: "10 Day", modal: 32040, resellerPrice: 45000, memberPrice: 51000 },
    ],
  },
  {
    name: "LKTEAM Root+PC",
    variants: [
      { id: 35, duration: "1Day", modal: 14240, resellerPrice: 18000, memberPrice: 23000 },
      { id: 36, duration: "5 Day", modal: 21360, resellerPrice: 25000, memberPrice: 33000 },
      { id: 37, duration: "10 Day", modal: 35600, resellerPrice: 48000, memberPrice: 54000 },
      { id: 38, duration: "30Day", modal: 106800, resellerPrice: 127000, memberPrice: 135000 },
    ],
  },
  {
    name: "pato Green Apkmod",
    variants: [
      { id: 41, duration: "7 Day", modal: 24920, resellerPrice: 35000, memberPrice: 40000 },
      { id: 42, duration: "15 Day", modal: 48060, resellerPrice: 65000, memberPrice: 73000 },
    ],
  },
  {
    name: "Pato Blue Apkmod",
    variants: [
      { id: 45, duration: "7 Day", modal: 24920, resellerPrice: 35000, memberPrice: 40000 },
      { id: 46, duration: "15 Day", modal: 48060, resellerPrice: 65000, memberPrice: 73000 },
      { id: 47, duration: "30Day", modal: 76540, resellerPrice: 97000, memberPrice: 105000 },
    ],
  },
  {
    name: "Brmod SilentAim PC",
    variants: [
      { id: 57, duration: "1Day", modal: 8900, resellerPrice: 13000, memberPrice: 17000 },
      { id: 58, duration: "10 Day", modal: 28480, resellerPrice: 41000, memberPrice: 47000 },
      { id: 59, duration: "30Day", modal: 56960, resellerPrice: 77000, memberPrice: 85000 },
    ],
  },
  {
    name: "BR Mods Root Android",
    variants: [
      { id: 61, duration: "1Day", modal: 4450, resellerPrice: 8000, memberPrice: 10000 },
      { id: 62, duration: "7Day", modal: 14240, resellerPrice: 25000, memberPrice: 30000 },
      { id: 63, duration: "15Day", modal: 28480, resellerPrice: 45000, memberPrice: 53000 },
      { id: 64, duration: "30Day", modal: 56960, resellerPrice: 77000, memberPrice: 85000 },
    ],
  },
  {
    name: "STRICKS BR [ ALPHA -X ]",
    variants: [
      { id: 77, duration: "1 Day", modal: 3560, resellerPrice: 8000, memberPrice: 10000 },
      { id: 78, duration: "3 Day", modal: 7120, resellerPrice: 11000, memberPrice: 16000 },
      { id: 79, duration: "5Day", modal: 8900, resellerPrice: 13000, memberPrice: 17000 },
      { id: 80, duration: "7 Day", modal: 12460, resellerPrice: 23000, memberPrice: 28000 },
      { id: 81, duration: "15Day", modal: 16020, resellerPrice: 33000, memberPrice: 41000 },
      { id: 82, duration: "30Day", modal: 35600, resellerPrice: 56000, memberPrice: 64000 },
    ],
  },
  {
    name: "GUILD GLORY BOT",
    variants: [
      { id: 122, duration: "Premium", modal: 53400, resellerPrice: 57000, memberPrice: 70000 },
      { id: 83, duration: "1 Basic", modal: 16910, resellerPrice: 21000, memberPrice: 28000 },
    ],
  },
  {
    name: "TM PANEL MOD APK",
    variants: [
      { id: 92, duration: "1 Day", modal: 17800, resellerPrice: 22000, memberPrice: 29000 },
      { id: 93, duration: "7 Day", modal: 35600, resellerPrice: 46000, memberPrice: 51000 },
      { id: 94, duration: "15Day", modal: 53400, resellerPrice: 70000, memberPrice: 78000 },
      { id: 95, duration: "30 Day", modal: 80100, resellerPrice: 101000, memberPrice: 109000 },
      { id: 96, duration: "Permanent", modal: 142400, resellerPrice: 146000, memberPrice: 160000 },
    ],
  },
  {
    name: "PATO REGEDIT NO ROOT",
    variants: [
      { id: 98, duration: "1 Day", modal: 12460, resellerPrice: 16000, memberPrice: 21000 },
      { id: 99, duration: "3 Day", modal: 17800, resellerPrice: 22000, memberPrice: 29000 },
      { id: 169, duration: "7 Day", modal: 24920, resellerPrice: 35000, memberPrice: 40000 },
      { id: 170, duration: "15 Days", modal: 48060, resellerPrice: 65000, memberPrice: 73000 },
      { id: 171, duration: "30 Days", modal: 76540, resellerPrice: 97000, memberPrice: 105000 },
    ],
  },
  {
    name: "REAPER X PRO ROOT",
    variants: [
      { id: 100, duration: "10 Days", modal: 26700, resellerPrice: 39000, memberPrice: 45000 },
      { id: 101, duration: "20 Days", modal: 62300, resellerPrice: 81000, memberPrice: 90000 },
      { id: 102, duration: "31 Days", modal: 117480, resellerPrice: 121000, memberPrice: 135000 },
    ],
  },
  {
    name: "GHOST ELITE STREMER ROOT",
    variants: [
      { id: 103, duration: "1 Day", modal: 8900, resellerPrice: 13000, memberPrice: 17000 },
      { id: 104, duration: "10 Days", modal: 26700, resellerPrice: 39000, memberPrice: 45000 },
      { id: 105, duration: "20 Days", modal: 62300, resellerPrice: 81000, memberPrice: 90000 },
      { id: 106, duration: "30 Day", modal: 106800, resellerPrice: 127000, memberPrice: 135000 },
    ],
  },
  {
    name: "SILENT CHEAT ROOT BRUTAL",
    variants: [
      { id: 136, duration: "1 Days", modal: 3916, resellerPrice: 8000, memberPrice: 10000 },
      { id: 137, duration: "3 Days", modal: 10680, resellerPrice: 15000, memberPrice: 19000 },
      { id: 138, duration: "7 Days", modal: 20470, resellerPrice: 31000, memberPrice: 36000 },
      { id: 139, duration: "14 Days", modal: 41830, resellerPrice: 58000, memberPrice: 66000 },
      { id: 140, duration: "28 Days", modal: 77430, resellerPrice: 98000, memberPrice: 107000 },
    ],
  },
];
