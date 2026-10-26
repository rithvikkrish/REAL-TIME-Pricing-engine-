export const REQUIRED_SYMBOLS = [
  'AUDUSD', 'AUDCAD', 'AUDCHF', 'AUDJPY', 'AUDNZD',
  'AUDSGD', 'CADCHF', 'CADJPY', 'CHFJPY', 'CHFSGD',
  'EURAUD', 'EURCAD', 'EURCHF', 'EURGBP', 'EURJPY',
  'EURNZD', 'EURUSD', 'GBPAUD', 'GBPCAD', 'GBPCHF',
  'GBPJPY', 'GBPNZD', 'GBPUSD', 'NZDCAD', 'NZDCHF',
  'NZDJPY', 'NZDUSD', 'USDCAD', 'USDCHF', 'USDCNH',
  'USDJPY', 'USDMXN', 'USDNOK', 'USDPLN', 'USDSEK',
  'USDSGD', 'USDTRY', 'USDZAR', 'EURTRY', 'GBPTRY',
  'NOKJPY', 'SEKJPY', 'SGDJPY', 'ZARJPY', 'XAUUSD',
  'XAGUSD', 'BTCUSD', 'ETHUSD', 'BNBUSD', 'SOLUSD',
  'XRPUSD', 'ADAUSD', 'DOGUSD', 'DOTUSD', 'LTCUSD',
  'BCHUSD', 'XLMUSD', 'TRXUSD', 'UNIUSD', 'FILUSD',
  'AVXUSD'
] as const;

export type SupportedSymbol = typeof REQUIRED_SYMBOLS[number];

export const VALID_SYMBOLS_SET: ReadonlySet<string> = new Set<string>(REQUIRED_SYMBOLS);

export function isValidSymbol(symbol: string): symbol is SupportedSymbol {
  return VALID_SYMBOLS_SET.has(symbol);
}
