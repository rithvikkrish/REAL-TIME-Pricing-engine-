import WebSocket from 'ws';
import { activeDownstreamClients, activeDownstreamSubscriptions } from '../metrics/prometheus';
import { isValidSymbol, SupportedSymbol } from '../config/symbols';

export class SubscriptionManager {
  // symbol -> Set of client sockets
  private symbolToClients: Map<string, Set<WebSocket>> = new Map();
  // client socket -> Set of subscribed symbols
  private clientToSymbols: Map<WebSocket, Set<string>> = new Map();

  public registerClient(client: WebSocket): void {
    if (!this.clientToSymbols.has(client)) {
      this.clientToSymbols.set(client, new Set());
      activeDownstreamClients.set(this.clientToSymbols.size);
    }
  }

  public removeClient(client: WebSocket): void {
    const subscribed = this.clientToSymbols.get(client);
    if (subscribed) {
      for (const symbol of subscribed) {
        const clientSet = this.symbolToClients.get(symbol);
        if (clientSet) {
          clientSet.delete(client);
          if (clientSet.size === 0) {
            this.symbolToClients.delete(symbol);
          }
        }
      }
      this.clientToSymbols.delete(client);
    }
    this.updateMetrics();
  }

  public subscribe(client: WebSocket, symbols: string[]): { valid: SupportedSymbol[]; invalid: string[] } {
    this.registerClient(client);
    const clientSymbols = this.clientToSymbols.get(client)!;
    const valid: SupportedSymbol[] = [];
    const invalid: string[] = [];

    for (const rawSym of symbols) {
      const sym = rawSym.toUpperCase().trim();
      if (isValidSymbol(sym)) {
        valid.push(sym);
        clientSymbols.add(sym);

        let clientSet = this.symbolToClients.get(sym);
        if (!clientSet) {
          clientSet = new Set();
          this.symbolToClients.set(sym, clientSet);
        }
        clientSet.add(client);
      } else {
        invalid.push(rawSym);
      }
    }

    this.updateMetrics();
    return { valid, invalid };
  }

  public unsubscribe(client: WebSocket, symbols: string[]): string[] {
    const clientSymbols = this.clientToSymbols.get(client);
    if (!clientSymbols) return [];

    const unsubscribed: string[] = [];
    for (const rawSym of symbols) {
      const sym = rawSym.toUpperCase().trim();
      if (clientSymbols.has(sym)) {
        clientSymbols.delete(sym);
        unsubscribed.push(sym);

        const clientSet = this.symbolToClients.get(sym);
        if (clientSet) {
          clientSet.delete(client);
          if (clientSet.size === 0) {
            this.symbolToClients.delete(sym);
          }
        }
      }
    }

    this.updateMetrics();
    return unsubscribed;
  }

  public getSubscribersForSymbol(symbol: string): ReadonlySet<WebSocket> | undefined {
    return this.symbolToClients.get(symbol);
  }

  public getClientSubscriptions(client: WebSocket): string[] {
    const set = this.clientToSymbols.get(client);
    return set ? Array.from(set) : [];
  }

  private updateMetrics(): void {
    activeDownstreamClients.set(this.clientToSymbols.size);
    let totalSubs = 0;
    for (const set of this.clientToSymbols.values()) {
      totalSubs += set.size;
    }
    activeDownstreamSubscriptions.set(totalSubs);
  }

  public clear(): void {
    this.symbolToClients.clear();
    this.clientToSymbols.clear();
    this.updateMetrics();
  }
}
