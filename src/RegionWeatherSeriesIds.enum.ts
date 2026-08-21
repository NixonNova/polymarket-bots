export enum RegionWeatherSeriesIds {

  // never loss cities, will be given priority
  AMSTERDAM = "11507",         // ~52.37°N
  AUSTIN = "11367",
  DALLAS = "10727",            // ~32.78°N
  HELSINKI = "11508",          // ~60.17°N
  HONG_KONG = "11312",         // ~22.32°N
  ISTANBUL = "11427",          // ~41.01°N
  JEDDAH = "11514",            // ~21.54°N
  KARACHI = "11530",           // ~24.86°N
  KUALA_LUMPUR = "11510",      // ~3.1°N
  LUCKNOW = "11271",           // ~26.85°N
  MADRID = "11345",            // ~40.42°N
  MANILA = "11531",            // ~14.60°N
  MEXICO_CITY = "11428",       // ~19.43°N
  MIAMI = "10728",             // ~25.76°N
  MILAN = "11343",             // ~45.46°N
  MOSCOW = "11426",            // ~55.76°N
  MUNICH = "11272",            // ~48.13°N
  NEW_YORK = "10005",          // ~40.71°N
  PANAMA_CITY = "11509",       // ~8.98°N
  SAO_PAULO = "11169",         // ~23.55°S
  SINGAPORE = "11314",         // ~1.35°N
  TEL_AVIV = "11295",          // ~32.09°N
  TOKYO = "10740",             // ~35.68°N
  WARSAW = "11342",            // ~52.23°N
  WELLINGTON = "10902",        // ~41.29°S
  WUHAN = "11364",             // ~30.59°N
  // commented out, due to too oftenly mispriced, causing cut loss, don't bet on these
  // or bet max $5 total

  // CHICAGO = "10726",
  // PARIS = "11168",
  // TORONTO = "10743",
  // LOS_ANGELES = "11370",
  // DENVER = "10730", 14 March missing 3h of metar incident
  // SHANGHAI = "10741",
  // SAN_FRANSISCO = "11371",
  // SEOUL = "10742",
  // ANKARA = "10900",  2 models max 15, end up 17 mid day, *consider to reapply
  // TAIPEI = "11346",  2 models max 31-32, cloudy, jump 2 degre to 33 at 11am, 23 April 2024 *consider to reapply
  // LAGOS = "11515",
  // BUSAN = "11506",-
  // ATLANTA = "10739",
  // CAPE_TOWN= "11516",    // ~33.92°S
  // SEATTLE = "10734",           // ~47.61°N
  // SHENZHEN = "11366",    // ~22.54°N
  // BEIJING = "11363",           // ~39.90°N
  // CHENGDU = "11365",     // ~30.57°N
  // CHONGQING = "11362",   // ~29.56°N
  // GUANGZHOU = "11529",   // ~23.13°N
  // BUENOS_AIRES = "10744",      // ~34.6°S
  // LONDON = "10006",            // ~51.51°N
  //   HOUSTON = "11369",           // ~29.76°N
  //  JAKARTA = "11511",           // ~6.2°S

  // Cut losses cities, must break 1 day or totally sidelined
  // Panic sold (ps) no need to be sidelined
  // Sidelined move list above

  // 15 April, Toronto, Milan
  // 16 April, Beijing(panic sold), Busan(panic sold), Chengdu(panic sold)
  // 17 April, Jeddah, spike 3 degrees, cut loss 41c
  // 18 April, Singapore*, Busan, Shanghai, Chongqin,  Chengdu, Toronto. Singapore sidelined 1 day, others permanent
  // 19 April, San Francisco
  // 20 April, Atlanta, can go higher, bet lower brackets. Cape town again.
  // 1 May, Chongqing. Atlanta permanently sidelined.
  // 2 May, Hong Kong.
  // 8 May, Warsaw
  // 9 May, Start to a very limited manual. Only eSport, good odds, small capital. Reboot the afternoon boot, excluding Buenos Aires
  // 11 May, fully automated every 4pm. Exclude Seattle
  // 13 May, Helsinky, reached high 16 at 19.30
  // 14 May, Weathers is now low risk deployment, Skip Yes and first No brackets.
  // 16 May, todo: if no incident, add back the Asian countries.
  // 18 May, todo: if no incident, add back the European countries
  // 20 May, let see if all good.
  
  // Maximized automated capital deployment:
  // 1. Afternoon capital deployment metarbytiming
  // 2. Endingsoonevents
  // 3. No prebetting overnight. Bet only when you wake up.
  // 4. Stick to the solid cities, limit to 5-6 cities per day
  // 12 May. No more manual weather bet. Only eSport and sport. Can follow live result
}