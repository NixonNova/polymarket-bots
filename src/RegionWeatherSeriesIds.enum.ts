export enum RegionWeatherSeriesIds {

  // never loss cities, will be given priority
  AMSTERDAM = "11507",
  ATLANTA = "10739",
  AUSTIN = "11367",
  BEIJING = "11363",
  BUENOS_AIRES = "10744",
  
  //BUSAN = "11506",-

  HELSINKI = "11508",
  HONG_KONG = "11312",
  HOUSTON = "11369",
  ISTANBUL = "11427",
  JAKARTA = "11511",
  KUALA_LUMPUR = "11510",
  LONDON = "10006",
  LUCKNOW = "11271",
  MADRID = "11345",
  MEXICO_CITY = "11428",
  MIAMI = "10728",
  MILAN = "11343",
  MOSCOW = "11426",
  MUNICH = "11272",
  NEW_YORK = "10005",  
  PANAMA_CITY = "11509",
  SAO_PAULO = "11169",
  SEATTLE = "10734",
  TEL_AVIV = "11295",
  TOKYO = "10740",
  WARSAW = "11342",
  WELLINGTON = "10902",

  // some losses cities
  CAPE_TOWN= "11516",
  CHENGDU = "11365",
  CHONGQING = "11362",
  DALLAS = "10727",
  GUANGZHOU = "11529",
  JEDDAH = "11514",
  KARACHI = "11530",
  MANILA = "11531",
  SHENZHEN = "11366",
  SINGAPORE = "11314",
  WUHAN = "11364",
  
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
  // ANKARA = "10900",  2 models max 15, end up 17 mid day
  // TAIPEI = "11346",  2 models max 31-32, cloudy, jump 2 degre to 33 at 11am, 23 April 2024
  // LAGOS = "11515",

  // Cut losses cities, must break 1 day or totally sidelined
  // Panic sold (ps) no need to be sidelined
  // Sidelined move list above

  // 15 April, Toronto, Milan
  // 16 April, Beijing(panic sold), Busan(panic sold), Chengdu(panic sold)
  // 17 April, Jeddah, spike 3 degrees, cut loss 41c
  // 18 April, Singapore*, Busan, Shanghai, Chongqin,  Chengdu, Toronto. Singapore sidelined 1 day, others permanent
  // 19 April, San Francisco


}