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
import { RegionWeatherSeriesIds } from './RegionWeatherSeriesIds.enum.js';
import { CryptoSeriesIds } from "./CryptoSeriesIds.enum.js";
import { StockSeriesIds } from "./StockSeriesIds.enum.js";
import IcaoList from "./IcaoList.json" with { type: "json" };
import fs from 'fs';
import path from 'path';
import axios from "axios";
import { PolymarketTagIds } from "./PolymarketTagIds.enum.js";

function resolveDotenvPath(): string {
  let dir = import.meta.dirname;
  for (let i = 0; i < 8; i++) {
    const envPath = resolve(dir, '.env');
    if (fs.existsSync(envPath)) return envPath;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd(), '.env');
}

dotenvConfig({ path: resolveDotenvPath() });

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
  const accountSid = process.env.TWILIO_ACCOUNTSID!;
  const authToken = process.env.TWILIO_AUTHTOKEN!;
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
  minPriceUsd: number = 0.985,
  maxPriceUsd: number = 0.994,
  maxNHoursToEndDate: number = 24,
): string[] {
  const outputArr: string[] = [];
  const isDebug: boolean = false;

  //const event = Array.isArray(polyEvents) && polyEvents.length > 0 ? polyEvents[polyEvents.length - 5] : undefined;
  let event: any = undefined;
  if (Array.isArray(polyEvents) && polyEvents.length > 0) {
    // Get only events within the maxNHoursToEndDate
    const validEvents = polyEvents.filter((e: any) => {
      if (e.endDate) {
        const endDate = new Date(e.endDate);
        const now = new Date();
        const diffHours = (endDate.getTime() - now.getTime()) / 1000 / 60 / 60;
        return diffHours < maxNHoursToEndDate;
      }
      return false;
    });

    if (validEvents.length > 1) {
      // Get the event with the latest endDate
      event = validEvents.reduce((latest: any, current: any) => {
        if (!latest) return current;
        return new Date(current.endDate) > new Date(latest.endDate) ? current : latest;
      }, undefined);
    } else {
      // Fallback to just picking the first valid event (if present)
      event = validEvents[0];
    }
  }


  if (event && Array.isArray(event.markets)) {

    if (isDebug) outputArr.push(String(event.title));

    event.markets
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
              outcomePriceNum >= minPriceUsd &&
              outcomePriceNum <= maxPriceUsd) {
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

async function scanMultiMarketExtractTopYESTokenId(
  polyEvents: any,
  minPriceUsd: number = 0.98,
  maxPriceUsd: number = 0.994,
  maxNHoursToEndDate: number = 24,
): Promise<string[]> {
  const outputArr: string[] = [];
  const isDebug: boolean = false;

  let event: any = undefined;
  if (Array.isArray(polyEvents) && polyEvents.length > 0) {
    // Get only events within the maxNHoursToEndDate
    const validEvents = polyEvents.filter((e: any) => {
      if (e.endDate) {
        const endDate = new Date(e.endDate);
        const now = new Date();
        const diffHours = (endDate.getTime() - now.getTime()) / 1000 / 60 / 60;
        return diffHours < maxNHoursToEndDate;
      }
      return false;
    });

    if (validEvents.length > 1) {
      // Get the event with the latest endDate
      event = validEvents.reduce((latest: any, current: any) => {
        if (!latest) return current;
        return new Date(current.endDate) > new Date(latest.endDate) ? current : latest;
      }, undefined);
    } else {
      // Fallback to just picking the first valid event (if present)
      event = validEvents[0];
    }
  }

  if (event && Array.isArray(event.markets)) {
    let yesTokenId: string = '';
    let isIncludedCapitalDeployment = false;

    if (isDebug) outputArr.push(String(event.title));
    event.markets
      .slice() // create a shallow copy to avoid mutating original
      .sort((a: any, b: any) => a.id - b.id)
      .slice(0, 100).forEach((market: any) => {

        if (market) {
          // Calculate max field lengths for padding
          const groupItemTitleStr = String(market.groupItemTitle ?? '');


          let clobTokenIdsArr: any[] = [];
          try {
            clobTokenIdsArr = Array.isArray(market.clobTokenIds)
              ? market.clobTokenIds
              : JSON.parse(market.clobTokenIds ?? '[]');
          } catch {
            clobTokenIdsArr = [];
          }

          let [clobTokenIdYES, clobTokenIdNO] = [...clobTokenIdsArr];

          // outcomePrices is a JSON-stringified array, so parse it and print only the second element
          const outcomePricesArr = Array.isArray(market.outcomePrices)
            ? market.outcomePrices
            : JSON.parse(market.outcomePrices ?? '[]');

          //let isIncludedCapitalDeployment = false;
          let outcomePricesStrYES = '';
          let outcomePricesStrNO = '';

          if (outcomePricesArr.length > 1) {
            let [outcomePriceYES, outcomePriceNO] = [...outcomePricesArr];

            outcomePricesStrYES = String(outcomePriceYES);
            outcomePricesStrNO = String(outcomePriceNO);

            const outcomePriceNumberYES = Number(outcomePriceYES);
            const outcomePriceNumberNO = Number(outcomePriceNO);

            // During iteration, deployment flag starts with false
            // Once condition is met, YES token will be included. And flag set to true
            if (!isNaN(outcomePriceNumberYES) &&
              outcomePriceNumberYES >= minPriceUsd &&
              outcomePriceNumberYES <= maxPriceUsd) {
              isIncludedCapitalDeployment = true;
              outcomePricesStrYES += ' *';
              //yesTokenId = clobTokenIdYES
              //console.log('YES ', groupItemTitleStr);
              outputArr.push(clobTokenIdYES)
              // continue to next iteration
              return;
            }

            // Iteration still ongoing, check for NO token and if deploy flag is true
            // If found, deploy too. Because once capital deployed to YES, deploy to NO is in the same side
            if (!isNaN(outcomePriceNumberNO) && isIncludedCapitalDeployment) {
              //console.log('NO ',groupItemTitleStr);
              outputArr.push(clobTokenIdNO)
            }
          }


          //const delimiter = ' ';

          // You would ideally align across all markets, but for one call, align based on current market
          //const groupItemTitleWidth = Math.max(groupItemTitleStr.length, 8);
          //const outcomePricesWidthYES = Math.max(outcomePricesStrYES.length, 14);
          //const outcomePricesWidthNO = Math.max(outcomePricesStrNO.length, 14);

          //if (isDebug && isIncludedCapitalDeployment) {
          //  outputArr.push(
          //    groupItemTitleStr.padEnd(groupItemTitleWidth) +
          //    delimiter +
          //    outcomePricesStrYES.padEnd(outcomePricesWidthYES) +
          //    delimiter +
          //    clobTokenIdYES
          //  );
          //} else {
          //  if (isIncludedCapitalDeployment) outputArr.push(clobTokenIdYES)
          //}

        }
      });
  }

  return outputArr;
}

// global config
const signer = new Wallet(process.env.POLY_EMAIL_PK!);
const host = 'https://clob.polymarket.com';
const signatureType = 1;  //email
//This is your Polymarket Profile Address, where you send UDSC to.
const funder = process.env.POLY_WALLET_ADD!;

async function newClobClient(): Promise<ClobClient> {

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

  return new ClobClient(
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

}

async function postOrders(
  clobTokenIds: string[],
  amountCapitalToDeployUsd: number = 10,
  minBuyOrderPrice?: number
): Promise<void> {
  const clobClient = await newClobClient()

  // refresh USDC balance
  await clobClient.updateBalanceAllowance({ asset_type: AssetType.COLLATERAL });

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

    if (isThisTokenNeverDeployedCapital && isThereMatchingAskPrice) {
      orderRequests.push({
        tokenID: tokenId,
        side: Side.BUY,
        ...(typeof minBuyOrderPrice !== "undefined" ? { price: minBuyOrderPrice } : {}),
        amount: amountCapitalToDeployUsd,
        orderType: OrderType.FAK,
      });
    }
  }

  if (!orderRequests.length) return;
  const orders = await Promise.all(
    orderRequests.map((orderReq) => clobClient.createMarketOrder(orderReq))
  );

  const chunkSize = 15; // because api limit to 15 in a batch
  const aggregateBy15Orders = chunkOrders(orders, chunkSize);

  const responses = [];
  for (const orderChunk of aggregateBy15Orders) {
    const response = await clobClient.postOrders(
      orderChunk.map((order) => ({ order, orderType: OrderType.FAK })),
    );
    responses.push(response);
  }

  console.log(responses)
}

function chunkOrders<T>(orders: T[], chunkSize: number): T[][] {
  // Break the orders array into chunks of at most 15 elements and put them into an aggregate variable
  const chunks: T[][] = [];
  for (let i = 0; i < orders.length; i += chunkSize) {
    chunks.push(orders.slice(i, i + chunkSize));
  }
  return chunks;
}


async function elonTweetsDeadBracketDeployer() {
  const minPriceUsd: number = 0.98;
  const maxPriceUsd: number = 0.99;
  const amountCapitalToDeployUsd: number = 25;
  const maxNHoursToEndDate = 48;

  const polyEvents = await fetchElonTweetsSeries();
  const tokendIds = scanMultiMarketExtractNoTokenIds(polyEvents, minPriceUsd, maxPriceUsd, maxNHoursToEndDate);

  await postOrders(tokendIds, amountCapitalToDeployUsd);

  //displayToScreen(tokendIds);
  //sendWhatsAppAppointmentReminder(scanEventsOutputArr);
  //const polyEventsOutputArr = constructOutputArr(polyEvents);

}


async function fetchMultiMarketBySeriesId(seriesId: string): Promise<any> {
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


async function fetchMetarByICAO(icaoCode: string): Promise<any> {
  const metarTafApiKey = process.env.METAR_TAF_APIKEY!;

  //const date = '2026-04-09';

  /*   const metar_taf_url =
      `https://api.metar-taf.com/metar-archive?api_key=${metarTafApiKey}&v=2.3&locale=en-US&id=${icaoCode}&date=${date}`;
   */
  // Get last 6 hours
  const metar_taf_url = `https://aviationweather.gov/api/data/metar?ids=${icaoCode}&hours=6&format=json`;

  try {
    const response = await fetch(metar_taf_url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch Weather series from Polymarket:', error);
  }
}

type IcaoConfig = { icao: string; timezone: string; seriesId: string };
type Metar = { obsTime: number; temp: number };

async function getMetarContainsLatestRecord(icaoConfig: IcaoConfig): Promise<Metar[]> {
  const waitMinutes = 1;
  const maxAttempt = 5;
  const maxMinsAgo = 15;
  const minHour = 12;
  const maxHour = 17;

  const debugFilePath = path.join(path.resolve(), 'debugByMetarTaf.txt');

  for (let attempt = 0; attempt < maxAttempt; attempt++) {
    const metars: Metar[] = await fetchMetarByICAO(icaoConfig.icao);

    if (Array.isArray(metars)) {

      // Combine sort and filter: filter metars having obsTime between 12pm to 6pm (12:00 to 18:59) in the ICAO local time, then sort ascending by obsTime
      const metarsNoonTo6pm: Metar[] = metars
        .filter((metar: Metar) => {
          const localDate = new Date(metar.obsTime * 1000);
          const hour = parseInt(
            localDate.toLocaleString("en-GB", {
              hour: "2-digit",
              hour12: false,
              timeZone: icaoConfig.timezone,
            }),
            10
          );
          return hour >= minHour && hour <= maxHour;
        })
        .sort((a, b) => a.obsTime - b.obsTime);

      const recordCountTime = new Date().toISOString();
      fs.appendFileSync(debugFilePath, `metarContainsLatestRecord count: ${metarsNoonTo6pm.length} at ${recordCountTime}\n`, { encoding: 'utf8' });

      if (metarsNoonTo6pm.length > 0) {
        const lastMetar = metarsNoonTo6pm[metarsNoonTo6pm.length - 1];
        const lastMetarObsTime = new Date(lastMetar.obsTime * 1000);
        const lastMetarObsTimeLocal = lastMetarObsTime.toLocaleString("en-GB", { timeZone: icaoConfig.timezone });
        const now = new Date(new Date().toLocaleString("en-US", { timeZone: icaoConfig.timezone }));
        const lastMetarObsTimeLocalDate = new Date(lastMetarObsTime.toLocaleString("en-US", { timeZone: icaoConfig.timezone }));
        let lastMetarMinsAgo = Math.round((now.getTime() - lastMetarObsTimeLocalDate.getTime()) / (60 * 1000));
        if (lastMetarMinsAgo < 1) lastMetarMinsAgo = 1;
        //console.log(`Last METAR obsTime local (${icaoConfig.timezone}):`, lastMetarObsTimeLocal, lastMetarMinsAgo);
        if (lastMetarMinsAgo <= maxMinsAgo) {
          return metarsNoonTo6pm;
        }
      }


      // Move 1 minute before retry
      await new Promise(resolve => setTimeout(resolve, waitMinutes * 60 * 1000));
    }
  }
  return [] as Metar[];
}

async function weatherMetarTrendChecker() {
  const seriesId = '11345'; //test madrid
  const icaoConfig = IcaoList.find((config: any) => String(config.seriesId) === String(seriesId));
  if (!icaoConfig) {
    throw new Error("ICAO config not found in IcaoList");
  }
  const metars: Metar[] = await fetchMetarByICAO(icaoConfig.icao);
  // Combine sort and filter: filter metars having obsTime between 12pm to 6pm (12:00 to 18:59) in the ICAO local time, then sort ascending by obsTime
  const midDayMetars: any[] = metars
    .filter((metar: Metar) => {
      const localDate = new Date(metar.obsTime * 1000);
      const hour = parseInt(
        localDate.toLocaleString("en-GB", {
          hour: "2-digit",
          hour12: false,
          timeZone: icaoConfig.timezone,
        }),
        10
      );
      return hour >= 1 && hour <= 17;
    })
    .sort((a, b) => a.obsTime - b.obsTime);


  let firstMetar: any = midDayMetars[0];

  console.log(firstMetar.name + ' ' + firstMetar.icaoId);
  //const lastMetarObsTime = new Date(lastMetar.obsTime * 1000);
  //const lastMetarObsTimeLocal = lastMetarObsTime.toLocaleString("en-GB", { timeZone: icaoConfig.timezone });


  console.table(
    midDayMetars.map((m) => ({
      City: m.name,
      Date: new Date(m.obsTime * 1000).toLocaleDateString(),
      Time: new Date(m.obsTime * 1000).toLocaleTimeString(),
      Temp: m.temp
    }))
  );

}

// This function rely on the timnig of metar release instead of the data
// Rely on the price move when YES token is reached 95c. So it can enter position more frequenly.
async function weatherByMetarTiming() {
  const seriesId = process.env.WEATHER_METAR_SERIES_ID;
  //const seriesId = 10740;

  const icaoConfig = IcaoList.find((config: any) => String(config.seriesId) === String(seriesId));
  if (!icaoConfig) {
    throw new Error("ICAO config not found in IcaoList");
  }

  // post order
  const minPriceUsd: number = 0.92;
  const maxPriceUsd: number = 0.995;
  const maxNHoursToEndDate = 12;
  const polyEvents = await fetchMultiMarketBySeriesId(icaoConfig.seriesId);
  const tokendIds = await scanMultiMarketExtractTopYESTokenId(polyEvents, minPriceUsd, maxPriceUsd, maxNHoursToEndDate);

  const amountCapitalToDeployUsd: number = 35;
  await postOrders(tokendIds, amountCapitalToDeployUsd);

}

async function weatherByMetarData() {
  const seriesId = process.env.WEATHER_METAR_SERIES_ID;

  const icaoConfig = IcaoList.find((config: any) => String(config.seriesId) === String(seriesId));
  if (!icaoConfig) {
    throw new Error("ICAO config not found in IcaoList");
  }

  const metarContainsLatestRecord = await getMetarContainsLatestRecord(icaoConfig);

  if (!metarContainsLatestRecord || metarContainsLatestRecord.length === 0) {
    return;
  }

  let prevTemp: number = metarContainsLatestRecord[0].temp;

  // find negative diff, start from first metar
  let hasNegativeDiffTemperature: boolean = false;
  let isInterruptedNegativeDiffTemperature = false;

  metarContainsLatestRecord
    .forEach((metar: any) => {
      let diffTemperature = metar.temp - prevTemp;

      // first iteration, element 0, diffTemp always 0
      // at element 1, it will always check relative to 0
      // this will start the real check starts from element 2
      isInterruptedNegativeDiffTemperature = (hasNegativeDiffTemperature && diffTemperature > 0);

      hasNegativeDiffTemperature = (diffTemperature < 0);
      prevTemp = metar.temp;
    })


  // Debug info: log metarContainsLatestRecord count before conditional check
  //const recordCountTime = new Date().toISOString();
  //fs.appendFileSync(debugFilePath, `metarContainsLatestRecord count: ${metarContainsLatestRecord.length} at ${recordCountTime}\n`, { encoding: 'utf8' });

  if (hasNegativeDiffTemperature && !isInterruptedNegativeDiffTemperature) {

    // Debug code: log to file if block is executed
    //const execTime = new Date().toISOString();
    //fs.appendFileSync(debugFilePath, `Executed at ${execTime}\n`, { encoding: 'utf8' });

    // post order
    const minPriceUsd: number = 0.90;
    const maxPriceUsd: number = 0.995;
    const maxNHoursToEndDate = 12;
    const polyEvents = await fetchMultiMarketBySeriesId(icaoConfig.seriesId);
    const tokendIds = await scanMultiMarketExtractTopYESTokenId(polyEvents, minPriceUsd, maxPriceUsd, maxNHoursToEndDate);

    const amountCapitalToDeployUsd: number = 50;
    await postOrders(tokendIds, amountCapitalToDeployUsd);
  }

}

async function weatherDeadBracketDeployer() {
  const minPriceUsd: number = 0.98;
  const maxPriceUsd: number = 0.99;
  const maxNHoursToEndDate = 12;
  const allSeriesTokenIds: string[] = [];
  //console.log("Scanning min price: " + minPriceUsd);
  for (const seriesId of Object.values(RegionWeatherSeriesIds)) {
    const polyEvents = await fetchMultiMarketBySeriesId(seriesId);
    const tokendIds = scanMultiMarketExtractNoTokenIds(polyEvents, minPriceUsd, maxPriceUsd, maxNHoursToEndDate);
    //const tokendIds = await scanMultiMarketExtractTopYESTokenId(polyEvents, minPriceUsd, maxPriceUsd, maxNHoursToEndDate);
    allSeriesTokenIds.push(...tokendIds);
  }
  //displayToScreen(allSeriesTokenIds);

  const amountCapitalToDeployUsd: number = 25;
  await postOrders(allSeriesTokenIds, amountCapitalToDeployUsd);
}


async function stocksDaily() {
  const minPriceUsd: number = 0.98;
  const maxPriceUsd: number = 0.994;
  const amountCapitalToDeployUsd: number = 5;
  const maxNHoursToEndDate = 12;
  const allSeriesTokenIds: string[] = [];
  for (const seriesId of Object.values(StockSeriesIds)) {
    const polyEvents = await fetchMultiMarketBySeriesId(seriesId);
    const tokendIds = scanMultiMarketExtractNoTokenIds(polyEvents, minPriceUsd, maxPriceUsd, maxNHoursToEndDate);
    allSeriesTokenIds.push(...tokendIds);
  }
  await postOrders(allSeriesTokenIds, amountCapitalToDeployUsd);
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
  const minPrice: number = 0.88;
  let tokenId;
  if (Number(prices[UPValidatedId].BUY) >= minPrice) { tokenId = UPValidatedId }
  else if (Number(prices[DOWNValidatedId].BUY) >= minPrice) { tokenId = DOWNValidatedId }

  const responseBuy = await clobClient.createAndPostMarketOrder(
    { tokenID: tokenId, side: Side.BUY, amount: 20 },
    {},
    OrderType.FAK
  );
  let takingAmount = 0;
  if (responseBuy.success) {
    takingAmount = responseBuy.takingAmount

    await clobClient.updateBalanceAllowance({
      asset_type: AssetType.CONDITIONAL,
      token_id: tokenId
    });
  }
  //console.log(response);
  //console.log(response.takingAmount);


  // Aggressive cut loss guard mechanism
  // 10 seconds hold, then, revalidate for last cut loss if less than 0.8  
  // Call getPrices after 10 seconds timeout
  await new Promise(resolve => setTimeout(resolve, 10000));
  const responseSell = await clobClient.createAndPostMarketOrder(
    { tokenID: tokenId, side: Side.SELL, amount: takingAmount - 0.01 },
    {},
    OrderType.FAK
  );

  /*   const recheckPrice = await clobClient.getPrices([
      { token_id: tokenId, side: Side.SELL },
    ]);
   */
  //console.log(recheckPrice)
  // Aggressive cut loss guard.   
  //const minThreshold = 0.90;   // less than 0.9, cut loss, market sell
  //const shouldCutLoss = takingAmount > 0 && Number(recheckPrice[tokenId].SELL) < minThreshold;
  //console.log(shouldCutLoss)
  //if (shouldCutLoss) {
  // Minus 0.01 because only takingAmount will always error not enough balance
  /*   const responseSell = await clobClient.createAndPostMarketOrder(
      { tokenID: tokenId, side: Side.SELL, amount: takingAmount - 0.01 },
      {},
      OrderType.FAK
    ); */
  //console.log(responseSell);
  //}
  return [];
}

async function cryptos(seriesId: CryptoSeriesIds) {
  const polyEvents = await fetchCryptoBySeries(seriesId);
  await scanCryptoUpDownExtractTokenIds(polyEvents);
}

async function fetchCryptoBySeries(seriesId: CryptoSeriesIds) {
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
}

async function fetchMyPositions() {
  const userId = '0xa5303c3d6321892667739ea611f2f6cb8a5188f6'
  const polymarket_get_positions_url =
    `https://data-api.polymarket.com/positions?sizeThreshold=1&limit=100&sortBy=TOKENS&sortDirection=DESC&user=${userId}`;



  try {
    const response = await fetch(polymarket_get_positions_url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch Weather data from Polymarket:', error);
  }

}

async function weatherLiquidator() {
  const allMyPositions = await fetchMyPositions();

  if (allMyPositions && Array.isArray(allMyPositions)) {
    let pnlThreshold = -30;   // -30%
    const negativePnLPositions = allMyPositions.filter((position: any) => {
      // if yes position, more loose with -50, if no position, which is mostly automated, stricter with -10%
      // all position yes or no apply -30% threshold because the dead bracket deployer is disabled.
      //pnlThreshold = position.outcomeIndex === 0 ? -30 : position.outcomeIndex === 1 ? -10 : pnlThreshold;
      return position.percentPnl < pnlThreshold
    }
    );

    const orderRequests: UserMarketOrder[] = [];
    const clobClient = await newClobClient()

    for (const pos of negativePnLPositions) {
      const book = await clobClient.getOrderBook(pos.asset);
      const isMatchingBidPrice = book && Array.isArray(book.bids) && book.bids.length > 0;
      if (isMatchingBidPrice) {

        // if position bigger than 50, then liquidate half.
        const sellAmount = pos.size > 50 ? pos.size / 2 : pos.size - 0.01;

        orderRequests.push({
          tokenID: pos.asset,
          side: Side.SELL,
          amount: sellAmount,
          orderType: OrderType.FAK,
        });
      }


    }

    if (!orderRequests.length) return;

    const orders = await Promise.all(
      orderRequests.map((orderReq) => clobClient.createMarketOrder(orderReq))
    );

    const chunkSize = 15; // because api limit to 15 in a batch
    const aggregateBy15Orders = chunkOrders(orders, chunkSize);

    //const responses = [];
    for (const orderChunk of aggregateBy15Orders) {
      const response = await clobClient.postOrders(
        orderChunk.map((order) => ({ order, orderType: OrderType.FAK })),
      );
      //responses.push(response);
    }
    //console.log(responses)
  }
}

async function fetchLiveEventsByTagId(tagIds: string[]): Promise<any> {
  const tagIdsQueryString = tagIds.map(id => `&tag_id=${encodeURIComponent(id)}`).join('');
  const getEventsByTagId_url = `https://gamma-api.polymarket.com/events/keyset?limit=100&ascending=true&live=true${tagIdsQueryString}`;
  try {
    const response = await fetch(getEventsByTagId_url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch from Polymarket:', error);
  }
}


async function dominantBracketDeployer(polymarketTagIds: string[]) {
  const outputArr: string[] = [];
  const ongoingEvents = await fetchLiveEventsByTagId(polymarketTagIds);

  if (Array.isArray(ongoingEvents.events)) {

    for (const event of ongoingEvents.events) {
      if (Array.isArray(event.markets)) {
        const liquidMarkets = event.markets.filter((market: any) => {
          const liquidity = typeof market.liquidity === 'string'
            ? parseFloat(market.liquidity)
            : market.liquidity;
          return liquidity > 5000;   //10k
        });


        for (const market of liquidMarkets) {

          // call get to get the latest version, because the one from event is stale
          // Fetch latest market data from Polymarket API by market.id
          const getMarketUrl = `https://gamma-api.polymarket.com/markets/${market.id}`;
          let latestMarket;
          try {
            const latestMarketResp = await fetch(getMarketUrl);
            if (!latestMarketResp.ok) {
              throw new Error(`HTTP error! status: ${latestMarketResp.status}`);
            }
            latestMarket = await latestMarketResp.json();
          } catch (e) {
            console.error(`Failed to fetch latest market ${market.id}:`, e);
            latestMarket = market; // fallback to original if failed
          }

          const clobTokenIdsArr = Array.isArray(latestMarket.clobTokenIds) ? latestMarket.clobTokenIds : JSON.parse(latestMarket.clobTokenIds ?? '[]');
          let [clobTokenIdLeft, clobTokenIdRight] = [...clobTokenIdsArr];

          const outcomePricesArr = Array.isArray(latestMarket.outcomePrices) ? latestMarket.outcomePrices : JSON.parse(latestMarket.outcomePrices ?? '[]');
          let [outcomePriceLeft, outcomePriceRight] = [...outcomePricesArr];

          const outcomePriceNumberLeft = Number(outcomePriceLeft);
          const outcomePriceNumberRight = Number(outcomePriceRight);

          // check left
          let dominantOutcomeTokenId = !isNaN(outcomePriceNumberLeft) && outcomePriceNumberLeft >= 0.92 && outcomePriceNumberLeft <= 0.98 ? clobTokenIdLeft : undefined;
          
          // check right
          if (dominantOutcomeTokenId === undefined) {
            dominantOutcomeTokenId = (!isNaN(outcomePriceNumberRight) && outcomePriceNumberRight >= 0.92 && outcomePriceNumberRight <= 0.98) ? clobTokenIdRight : undefined;
          }
     
          if (dominantOutcomeTokenId !== undefined) {
            outputArr.push(dominantOutcomeTokenId);
          }

          //if (typeof market.question === 'string' && market.question.includes('Raptor')) {
          //console.log(event.id, ' ', latestMarket.id, ' ', latestMarket.question, ' ' ,latestMarket.outcomes, ' ', latestMarket.outcomePrices, ' ', latestMarket.liquidity);
          //}
        }
      }
    }
  }
  const amountCapitalToDeployUsd: number = 10;
  //console.log(outputArr)
  if (outputArr.length > 0) {
    await postOrders(outputArr, amountCapitalToDeployUsd);
  }

  //}
}

interface WeatherResult {
  model: string;
  maxTemp: number | null;
}

/**
* Fetches daily max temp from ECMWF, GFS, and HRRR.
* @param icao - 4-letter ICAO code (e.g., 'EGLL', 'KJFK')
* @param date - Format 'YYYY-MM-DD'
*/
async function getModelMaxTemps(icao: string, date: string, unit: string = "celsius"): Promise<WeatherResult[]> {
  try {
    // 1. Get Coordinates using the exact AWC endpoint
    const awcUrl = `https://aviationweather.gov/api/data/metar?ids=${icao}&format=json`;
    const geoResponse = await axios.get(awcUrl, {
      headers: { 'Accept': 'application/json' } // Force JSON response
    });

    if (!geoResponse.data || geoResponse.data.length === 0) {
      throw new Error(`ICAO code ${icao} not found.`);
    }

    // AWC returns an array of METAR objects; grab the first one
    const { lat, lon } = geoResponse.data[0];

    // 2. Query Open-Meteo with explicit JSON request
    const forecastUrl = "https://api.open-meteo.com/v1/forecast";
    const params = {
      latitude: lat,
      longitude: lon,
      daily: "temperature_2m_max",
      timezone: "auto",
      start_date: date,
      end_date: date,
      temperature_unit: unit,
      format: "json",
      timeformat: "unixtime",
      models: "gfs_seamless,ecmwf_ifs" // Requesting specific models
    };
    //gfs_seamless + hrrr_conus, open meteo combined these 2 models for American Models
    //ecmwf_ifs -> European models

    const weatherResponse = await axios.get(forecastUrl, { params });
    const daily = weatherResponse.data.daily;

    return [
      { model: 'ECMWF', maxTemp: daily?.temperature_2m_max_ecmwf_ifs?.[0] ?? null },
      { model: 'GFS+HRRR', maxTemp: daily?.temperature_2m_max_gfs_seamless?.[0] ?? null },
    ];

  } catch (error: any) {
    // Better error logging to see if HTML is being returned
    if (error.response && typeof error.response.data === 'string' && error.response.data.includes('<!DOCTYPE html>')) {
      console.error("Critical: Received HTML instead of JSON. Check the API URL or your query parameters.");
    } else {
      console.error("Error fetching data:", error.message);
    }
    return [];
  }
}

async function getBracketOutcomePrice(seriesId: string, maxTemperature: number, maxTemperatureUnit: string, targetDate: string) {
  const findGroupItemTitleSuffix = `${maxTemperature}°${maxTemperatureUnit}`;
  const findGroupItemTitlePrefix = `${maxTemperature}-`;
  const polyEvents = await fetchMultiMarketBySeriesId(seriesId);
  if (Array.isArray(polyEvents)) {
    for (const event of polyEvents) {
      if (Array.isArray(event.markets)) {
        for (const market of event.markets) {
          //console.log(findGroupItemTitleSuffix, ' ',market.groupItemTitle)
          if (
            typeof market.groupItemTitle === "string" &&
            (market.groupItemTitle.includes(findGroupItemTitleSuffix) || market.groupItemTitle.includes(findGroupItemTitlePrefix)) &&
            typeof market.endDate === "string" &&
            market.endDate.includes(targetDate)
          ) {
            //console.log(findGroupItemTitleSuffix, ' ',market.groupItemTitle)

            let outcomePricesArr: any[] = [];
            try {
              outcomePricesArr = Array.isArray(market.outcomePrices)
                ? market.outcomePrices
                : JSON.parse(market.outcomePrices ?? '[]');
            } catch {
              outcomePricesArr = [];
            }

            return Number(outcomePricesArr[0]);

          }

        }
      }
    }
  }
}


async function weatherMajorModelsScanner() {
  // Example usage
  const targetDate = "2026-04-28";
  // Convert targetDate 
  const dateObj = new Date(targetDate);
  const monthLong = dateObj.toLocaleString("en-US", { month: "long" });
  const day = dateObj.getDate();
  const year = dateObj.getFullYear();


  console.log(`\x1b[1m${day} ${monthLong} ${year}\x1b[0m`);

  const icaoList = IcaoList;
  let flattenedResult: any[] = [];

  const page = 2;
  const take = 5;
  const start = (page - 1) * take;
  const end = start + take;
  for (const entry of icaoList.slice(start, end)) {
    // Find enum name in RegionWeatherSeriesIds by matching value to entry.seriesId
    let enumName: string | null = null;
    for (const [key, value] of Object.entries(RegionWeatherSeriesIds)) {
      if (value === entry.seriesId) {
        enumName = key;
        break;
      }
    }

    const result = await getModelMaxTemps(entry.icao, targetDate, entry.unit);
    const tempOffset = 1;  // need to add offset because max temp is measured 2meter above the ground. METAR equipment is on the ground, usually hotter.

    const minTemp = Math.floor(Math.min(
      result.find(r => r.model === 'ECMWF')?.maxTemp ?? Infinity,
      result.find(r => r.model === 'GFS+HRRR')?.maxTemp ?? Infinity
    ));
    const maxTemp = Math.ceil(Math.max(
      result.find(r => r.model === 'ECMWF')?.maxTemp ?? -Infinity,
      result.find(r => r.model === 'GFS+HRRR')?.maxTemp ?? -Infinity
    ));

    const newflattenedResult = {
      City: enumName,
      Icao: entry.icao,
      ...(Array.isArray(result) ? Object.fromEntries(result.map(r => [r.model, r.maxTemp])) : {}),
      "Range + 1": (Array.isArray(result) && result.length >= 2)
        ? (() => {
          return `${tempOffset + minTemp} to ${tempOffset + maxTemp}`;
        })()
        : null,
      Unit: entry.unit,
/*       "min bracket-1 %": await getBracketOutcomePrice(
        entry.seriesId,
        (tempOffset + minTemp) - 1,
        entry.unit === 'celsius' ? 'C' : 'F',
        targetDate
      ),

      "min bracket-2 %": await getBracketOutcomePrice(
        entry.seriesId,
        (tempOffset + minTemp) - 2,
        entry.unit === 'celsius' ? 'C' : 'F',
        targetDate
      ) */
    }

    flattenedResult.push(newflattenedResult);

  }
  console.table(flattenedResult);
}

// If this file is run directly (e.g. with ts-node), execute the fetch.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  //weatherMetarTrendChecker();

  //weatherByMetarData();
  //weatherByMetarTiming();
  //weatherLiquidator();

  //weatherDeadBracketDeployer();

  //weatherMajorModelsScanner();

  // separate to different task scheduler
  //dominantBracketDeployer([PolymarketTagIds.NBA]);
  //dominantBracketDeployer([PolymarketTagIds.Tennis]);
  dominantBracketDeployer([PolymarketTagIds.Counter_Strike_2]);

  //elonTweetsDeadBracketDeployer();
  //weatherDaily();
  //stocksDaily();
  //cryptos(CryptoSeriesIds.BITCOIN_5MINS);
  //cryptos(CryptoSeriesIds.BITCOIN_15MINS);
}