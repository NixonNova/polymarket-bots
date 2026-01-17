import twilio from "twilio";
import { fileURLToPath } from 'url';


/**
 * Fetches the latest Elon Tweets series event from Polymarket
 * and prints the JSON response to the console.
 *
 * Data source:
 * `https://gamma-api.polymarket.com/events?series_id=10000&limit=1&closed=false`
 */
async function fetchElonTweetsSeries(): Promise<any> {
  const SERIES_ID = '10000';
  const LIMIT = '5';
  const CLOSED = 'false';
  const POLYMARKET_ELON_TWEETS_URL =
    `https://gamma-api.polymarket.com/events?series_id=${SERIES_ID}&limit=${LIMIT}&closed=${CLOSED}`;
  
  try {

    const response = await fetch(POLYMARKET_ELON_TWEETS_URL);
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

function scanEvents(polyEvents: any): string[] {
  const outputArr: string[] = [];

  // scan only last event

  // get last event
  const lastEvent = Array.isArray(polyEvents) && polyEvents.length > 0 ? polyEvents[polyEvents.length - 1] : undefined;

  if (lastEvent && Array.isArray(lastEvent.markets)) {
    outputArr.push(String(lastEvent.title));
    lastEvent.markets
      .slice() // create a shallow copy to avoid mutating original
      .sort((a: any, b: any) => a.id - b.id)
      .slice(0, 20).forEach((market: any) => {

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

        let outcomePricesStr = '';
        if (outcomePricesArr.length > 1) {
          outcomePricesStr = String(outcomePricesArr[1]);
          const outcomePriceNum = Number(outcomePricesArr[1]);
          if (!isNaN(outcomePriceNum) && outcomePriceNum <= 0.95) {
            outcomePricesStr += ' *';
          }
        }

        const delimiter = ' ';

        // You would ideally align across all markets, but for one call, align based on current market
        const groupItemTitleWidth = Math.max(groupItemTitleStr.length, 8);
        const outcomePricesWidth = Math.max(outcomePricesStr.length, 14);

        outputArr.push(
          groupItemTitleStr.padEnd(groupItemTitleWidth) +
          delimiter +
          outcomePricesStr.padEnd(outcomePricesWidth)
        );
      }
    });
  }
  return outputArr;
}

// If this file is run directly (e.g. with ts-node), execute the fetch.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {

  const polyEvents = await fetchElonTweetsSeries();

  
  const scanEventsOutputArr = scanEvents(polyEvents);
  sendWhatsAppAppointmentReminder(scanEventsOutputArr);

    //const polyEventsOutputArr = constructOutputArr(polyEvents);
  //displayToScreen(scanEventsOutputArr);


  // Add delay
  // await new Promise((resolve) => setTimeout(resolve, 10000));

}