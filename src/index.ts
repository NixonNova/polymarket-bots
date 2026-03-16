import twilio from "twilio";
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { ClobClient, OrderType, Side, Chain, AssetType, UserMarketOrder } from "@polymarket/clob-client";
import { Wallet } from "@ethersproject/wallet";
import {
  BuilderConfig,
  BuilderApiKeyCreds,
} from "@polymarket/builder-signing-sdk";
import { RegionWeatherSeriesIDs } from './regionWheaterSeries.enum.js';
import { CryptoSeriesIDs } from "./cryptoSeries.enum.js";

dotenvConfig({ path: resolve(import.meta.dirname, "../.env") });


/**
 * Fetches the latest Elon Tweets series event from Polymarket
 * and prints the JSON response to the console.
 *
 * Data source:
 * `https://gamma-api.polymarket.com/events?series_id=10000&limit=1&closed=false`
 */
async function fetchElonTweetsSeries(): Promise<any> {
  const ELON_TWEET_SERIES_ID = '10000';
  const limit = '5';
  const isClosed = 'false';
  const polymarketElonTweetsUrl =
    `https://gamma-api.polymarket.com/events?series_id=${ELON_TWEET_SERIES_ID}&limit=${limit}&closed=${isClosed}`;

  try {

    const response = await fetch(polymarketElonTweetsUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch Elon Tweets series from Polymarket:', error);
  }

}

function sendWhatsAppAppointmentReminder(output: string[]) {
  const accountSid = 'AC57d3b83851c059fc62a955b718e4cc30';
  const authToken = '4e4dc75f524583a0fda7dd53a9302314';
  const client = twilio(accountSid, authToken);

  const messageBody = output.join('\n');

  client.messages
    .create({
      body: messageBody,
      from: 'whatsapp:+14155238886',
      to: 'whatsapp:+85259316658',
    })
    .then((message) => console.log(`Message SID: ${message.sid}`))
    .catch((error) => console.error(error));
}

function constructOutputText(data: any): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Hong_Kong',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  if (!data) return '';
  const createdAtDate = new Date(data.createdAt);
  const parts = formatter.formatToParts(createdAtDate);
  const formattedDate = `${parts.find(p => p.type === 'day')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'year')?.value}`;
  return `id: ${data.id}, title: ${data.title}, created at: ${formattedDate} HKT/GMT+8`;
}

function constructOutputArr(polyEvents: any): string[] {
  let output: string[] = [];
  if (Array.isArray(polyEvents) && polyEvents.length > 0) {
    polyEvents.forEach((polyEvent: any) => {
      const outputItem = constructOutputText(polyEvent);
      output.push(outputItem);
    });
  } else {
    console.log('No Elon Tweets series events found.');
  }

  return output;
}

function displayToScreen(outputArr: Array<any>): void {
  console.log(outputArr.join('\n'));
}

function scanMultiMarketExtractNoTokenIds(
  polyEvents: any,
  profitMarginDollarLo: number = 0.002,  //0.2 cents
  profitMarginDollarHi: number = 0.02    //2 cents
): string[] {
  const outputArr: string[] = [];
  const isDebug: boolean = false;
  // scan only last event

  // get last event
  const lastEvent = Array.isArray(polyEvents) && polyEvents.length > 0 ? polyEvents[polyEvents.length - 4] : undefined;

  if (lastEvent && Array.isArray(lastEvent.markets)) {

    if (isDebug) outputArr.push(String(lastEvent.title));

    lastEvent.markets
      .slice() // create a shallow copy to avoid mutating original
      .sort((a: any, b: any) => a.id - b.id)
      .slice(0, 100).forEach((market: any) => {

        if (market) {
          // Calculate max field lengths for padding
          const groupItemTitleStr = String(market.groupItemTitle ?? '');

          // outcomePrices is a JSON-stringified array, so parse it and print only the second element
          let outcomePricesArr: any[] = [];
          try {
            outcomePricesArr = Array.isArray(market.outcomePrices)
              ? market.outcomePrices
              : JSON.parse(market.outcomePrices ?? '[]');
          } catch {
            outcomePricesArr = [];
          }

          let clobTokenIdsArr: any[] = [];
          try {
            clobTokenIdsArr = Array.isArray(market.clobTokenIds)
              ? market.clobTokenIds
              : JSON.parse(market.clobTokenIds ?? '[]');
          } catch {
            clobTokenIdsArr = [];
          }

          let clobTokenIdNO = clobTokenIdsArr[1];

          outcomePricesArr = Array.isArray(market.outcomePrices)
            ? market.outcomePrices
            : JSON.parse(market.outcomePrices ?? '[]');


          let isIncludedCapitalDeployment = false;

          let outcomePricesStr = '';

          if (outcomePricesArr.length > 1) {
            outcomePricesStr = String(outcomePricesArr[1]);
            const outcomePriceNum = Number(outcomePricesArr[1]);
            if (!isNaN(outcomePriceNum) &&
              outcomePriceNum >= 1 - profitMarginDollarHi &&
              outcomePriceNum <= 1 - profitMarginDollarLo) {
              isIncludedCapitalDeployment = true;
              outcomePricesStr += ' *';
            }
          }

          const delimiter = ' ';

          // You would ideally align across all markets, but for one call, align based on current market
          const groupItemTitleWidth = Math.max(groupItemTitleStr.length, 8);
          const outcomePricesWidth = Math.max(outcomePricesStr.length, 14);

          if (isDebug) {
            outputArr.push(
              groupItemTitleStr.padEnd(groupItemTitleWidth) +
              delimiter +
              outcomePricesStr.padEnd(outcomePricesWidth) +
              delimiter +
              clobTokenIdNO
            );
          } else {
            if (isIncludedCapitalDeployment) outputArr.push(clobTokenIdNO)
          }

        }
      });
  }
  return outputArr;
}

async function postOrders(clobTokenIds: string[]): Promise<void> {

  const host = 'https://clob.polymarket.com';
  const signatureType = 1;  //email
  //This is your Polymarket Profile Address, where you send UDSC to.
  const funder = process.env.POLY_WALLET_ADD!;
  const signer = new Wallet(process.env.POLY_EMAIL_PK!);

  //In general don't create a new API key, always derive or createOrDerive
  const apiCreds = new ClobClient(host, Chain.POLYGON, signer).createOrDeriveApiKey();

  // Builder key
  const builderCreds: BuilderApiKeyCreds = {
    key: process.env.POLY_BUILDER_API_KEY!,
    secret: process.env.POLY_BUILDER_SECRET!,
    passphrase: process.env.POLY_BUILDER_PASSPHRASE!,
  };
  const builderConfig = new BuilderConfig({
    localBuilderCreds: builderCreds,
  });

  const clobClient = new ClobClient(
    "https://clob.polymarket.com",
    Chain.POLYGON,
    signer,
    await apiCreds,
    signatureType,
    funder,
    undefined,
    false,
    builderConfig,
  );

  // refresh USDC balance
  await clobClient.updateBalanceAllowance({ asset_type: AssetType.COLLATERAL });

  const capitalAmountPerDeploymentDollar = 75; //$75
  const orderRequests: UserMarketOrder[] = [];

  for (const tokenId of clobTokenIds) {

    // check if trade is available, if available then don't deploy another capital here
    const trades = await clobClient.getTrades({
      asset_id: tokenId, // NO
      maker_address: funder,
    })
    const isThisTokenNeverDeployedCapital = !Array.isArray(trades) || trades.length === 0;

    // check if ask is available
    const book = await clobClient.getOrderBook(tokenId);
    const isThereMatchingAskPrice = book && Array.isArray(book.asks) && book.asks.length > 0;

    // only deploy capital if no trade in the asset
    if (isThisTokenNeverDeployedCapital && isThereMatchingAskPrice) {
      orderRequests.push({
        tokenID: tokenId,
        side: Side.BUY,
        amount: capitalAmountPerDeploymentDollar,
        orderType: OrderType.FAK,
      });
    }
  }

  if (!orderRequests.length) return;
  const orders = await Promise.all(
    orderRequests.map((orderReq) => clobClient.createMarketOrder(orderReq))
  );
  // console.log(orders)

  // Break the orders array into chunks of at most 15 elements and put them into an aggregate variable
  const aggregateBy15Orders: typeof orders[] = [];
  const chunkSize = 15; // because api limit to 15 in a batch
  for (let i = 0; i < orders.length; i += chunkSize) {
    aggregateBy15Orders.push(orders.slice(i, i + chunkSize));
  }

  const responses = [];
  for (const orderChunk of aggregateBy15Orders) {
    const response = await clobClient.postOrders(
      orderChunk.map((order) => ({ order, orderType: OrderType.FAK })),
    );
    responses.push(response);
  }

  console.log(responses)
}


async function elonTweets() {
  const profitMarginDollarLo: number = 0.002  //0.2 cents NOT dollar
  const profitMarginDollarHi: number = 0.008  //0.8 cents

  const polyEvents = await fetchElonTweetsSeries();
  const tokendIds = scanMultiMarketExtractNoTokenIds(polyEvents, profitMarginDollarLo, profitMarginDollarHi);
  await postOrders(tokendIds);

  //displayToScreen(tokendIds);
  //sendWhatsAppAppointmentReminder(scanEventsOutputArr);
  //const polyEventsOutputArr = constructOutputArr(polyEvents);

}


async function fetchWeatherSeries(seriesId: string): Promise<any> {
  const limit = '5';
  const isClosed = 'false';
  const polymarket_wheater_url =
    `https://gamma-api.polymarket.com/events?series_id=${seriesId}&limit=${limit}&closed=${isClosed}`;

  try {
    const response = await fetch(polymarket_wheater_url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch Weather series from Polymarket:', error);
  }
}

async function weatherHighestDaily() {
  const profitMarginDollarLo: number = 0.010;  // 0.8 cents NOT dollar
  const profitMarginDollarHi: number = 0.020;   // 2 cents
  const allSeriesTokenIds: string[] = [];
  for (const seriesId of Object.values(RegionWeatherSeriesIDs)) {
    const polyEvents = await fetchWeatherSeries(seriesId);
    const tokendIds = scanMultiMarketExtractNoTokenIds(polyEvents, profitMarginDollarLo, profitMarginDollarHi);
    allSeriesTokenIds.push(...tokendIds);
  }
  await postOrders(allSeriesTokenIds);
  //displayToScreen(allSeriesTokenIds);
}

async function scanCryptoUpDownExtractTokenIds(
  polyEvents: any
): Promise<string[]> {


  const host = 'https://clob.polymarket.com';
  const signatureType = 1;  //email
  //This is your Polymarket Profile Address, where you send UDSC to.
  const funder = process.env.POLY_WALLET_ADD!;
  const signer = new Wallet(process.env.POLY_EMAIL_PK!);

  //In general don't create a new API key, always derive or createOrDerive
  const apiCreds = new ClobClient(host, Chain.POLYGON, signer).createOrDeriveApiKey();

  const clobClient = new ClobClient(
    "https://clob.polymarket.com",
    Chain.POLYGON,
    signer,
    await apiCreds,
    signatureType,
    funder,
    undefined,
    false,
  );

  const timeValidatedIds = []

  // locate current market
  if (Array.isArray(polyEvents)) {
    for (const polyEvent of polyEvents) {
      if (Array.isArray(polyEvent.markets)) {
        for (const market of polyEvent.markets) {
          {
            const dateUTC = new Date(market.endDate);
            // Convert to Eastern Time (ET), which is 'America/New_York'
            //const etStr = dateUTC.toLocaleString('en-US', { timeZone: 'America/New_York' });
            // Only print if market.endDate is less than 30 seconds from now
            const now = new Date();
            const diffMs = dateUTC.getTime() - now.getTime();

            let clobTokenIdsArr: any[] = [];
            try {
              clobTokenIdsArr = Array.isArray(market.clobTokenIds)
                ? market.clobTokenIds
                : JSON.parse(market.clobTokenIds ?? '[]');
            } catch {
              clobTokenIdsArr = [];
            }
            const UP = clobTokenIdsArr[0];
            const DOWN = clobTokenIdsArr[1];

            /*             const prices =
                        {
                          '49308518289883234435292190191223173586654432722120832996296713313903341282574': { BUY: '0.5', SELL: '0.51' },
                          '97970745765891147583037570852124103688276664618571067478875376387948344884216': { BUY: '0.49', SELL: '0.5' }
                        };
             */

            // Condition guard, to locate market where the end time is less than 30 seconds
            // On top of this condition, this script is ran by scheduler every 5 minutes, kicked off 20 seconds before time is up
            if (diffMs < 30 * 1000 && diffMs > 0) {
              //  console.log(market.question + ' / ' + etStr + ' / ' + market.id);
              //  console.log(prices);
              timeValidatedIds.push(UP)
              timeValidatedIds.push(DOWN)

            }
          }
        }
      }
    }
  } else {
    console.warn("polyEvents is not an array:", polyEvents);
  }

  //price validation
  const UPValidatedId = timeValidatedIds[0];
  const DOWNValidatedId = timeValidatedIds[1];
  const prices = await clobClient.getPrices([
    { token_id: UPValidatedId, side: Side.BUY },
    { token_id: DOWNValidatedId, side: Side.BUY },
  ]);

  // Objectives: Only buy any side (once) when timer is less than 15 seconds AND price is more than 85 cents
  const minPrice: number = 0.85;
  let tokenId;
  if (Number(prices[UPValidatedId].BUY) >= minPrice) { tokenId = UPValidatedId }
  else if (Number(prices[DOWNValidatedId].BUY) >= minPrice) { tokenId = DOWNValidatedId }

  const response = await clobClient.createAndPostMarketOrder(
    { tokenID: tokenId, side: Side.BUY, amount: 3 },
    {},
    OrderType.FAK
  );
  let takingAmount = 0;
  if (response.success){
    takingAmount = response.takingAmount
  }
  console.log(response);


  // Aggressive cut loss guard mechanism
  // 10 seconds hold, then, revalidate for last cut loss if less than 0.9  
  // Call getPrices after 10 seconds timeout
  await new Promise(resolve => setTimeout(resolve, 10000));
  const recheckPrice = await clobClient.getPrices([
    { token_id: tokenId, side: Side.SELL },
  ]);

  // Aggressive cut loss guard.   
  const minThreshold = 0.8;   // less than 0.8, cut loss, market sell
  const shouldCutLoss = Number(recheckPrice[tokenId].BUY) < minThreshold;
  if (shouldCutLoss) {
    const response = await clobClient.createAndPostMarketOrder(
      { tokenID: tokenId, side: Side.SELL, amount: takingAmount },
      {},
      OrderType.FAK
    );
    console.log(response);
  }
  return [];
}

async function bitcoin5Minutes() {
  const polyEvents = await fetchCrypto5Minutes(CryptoSeriesIDs.BITCOIN);
  await scanCryptoUpDownExtractTokenIds(polyEvents);
}

async function ethereum5Minutes() {
  const polyEvents = await fetchCrypto5Minutes(CryptoSeriesIDs.ETHEREUM);
  await scanCryptoUpDownExtractTokenIds(polyEvents);
}


async function fetchCrypto5Minutes(seriesId: CryptoSeriesIDs) {
  const limit = '350';
  const polymarket_crypto_5minutes_url =
    `https://gamma-api.polymarket.com/events?series_id=${seriesId}&limit=${limit}&active=true&closed=false&ascending=false&order=endDate&`;

  try {
    const response = await fetch(polymarket_crypto_5minutes_url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch Weather data from Polymarket:', error);
  }
  //await postOrders(allSeriesTokenIds);
  //displayToScreen(allSeriesTokenIds);
}



// If this file is run directly (e.g. with ts-node), execute the fetch.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {

  // elonTweets();
  weatherHighestDaily();
  // bitcoin5Minutes();
  //ethereum5Minutes();
  // console.log('test scheduler')
  //console.log(polyEvents);

}