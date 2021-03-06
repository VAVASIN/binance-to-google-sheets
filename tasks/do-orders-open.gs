/**
 * Runs the open orders script.
 */
function BinDoOrdersOpen() {
  let lock_retries = 5; // Max retries to acquire lock

  /**
   * Returns this function tag (the one that's used for BINANCE function 1st parameter)
   */
  function tag() {
    return "orders/open";
  }

  /**
   * Returns true if the given operation belongs to this code
   */
  function is(operation) {
    return operation === tag();
  }

  /**
   * Returns this function period (the one that's used by the refresh triggers)
   */
  function period() {
    return BinScheduler().getSchedule(tag()) || "5m";
  }
  
  /**
   * Returns current open oders.
   *
   * @param {"BTCUSDT|..."} symbol If given, returns just the matching symbol open orders.
   * @param options An option list like "headers: false"
   * @return The list of all current open orders for all or given symbol/ticker.
   */
  function run(symbol, options) {
    const bs = BinScheduler();
    try {
      bs.clearFailed(tag());
      return execute(symbol, options);
    } catch(err) { // Re-schedule this failed run!
      bs.rescheduleFailed(tag());
      throw err;
    }
  }

  function execute(symbol, options) {
    Logger.log("[BinDoOrdersOpen] Running..");
    const lock = BinUtils().getUserLock(lock_retries--);
    if (!lock) { // Could not acquire lock! => Retry
      return execute(symbol, options);
    }
    
    const opts = {CACHE_TTL: 55};
    const data = BinRequest(opts).get("api/v3/openOrders", "", "");
  
    BinUtils().releaseLock(lock);
    const parsed = parse(symbol ? filter(data, symbol) : data, options);
    Logger.log("[BinDoOrdersOpen] Done!");
    return parsed;
  }

  function filter(data, symbol) {
    return data.filter(function(ticker) {
      return ticker.symbol == symbol;
    });
  }

  function parse(data, {headers: show_headers}) {
    const header = ["Date", "Pair", "Type", "Side", "Price", "Amount", "Executed", "Total"];
    const parsed = data.reduce(function(rows, order) {
      const symbol = order.symbol;
      const price = BinUtils().parsePrice(order.price);
      const amount = parseFloat(order.origQty);
      const row = [
        new Date(parseInt(order.time)),
        symbol,
        order.type,
        order.side,
        price,
        amount,
        parseFloat(order.executedQty),
        price*amount
      ];
      rows.push(row);
      return rows;
    }, BinUtils().parseBool(show_headers) ? [header] : []);

    return BinUtils().sortResults(parsed, 0, true);
  }

  // Return just what's needed from outside!
  return {
    tag,
    is,
    period,
    run
  };
}