function isNull(val) {
  return val === null || val === undefined || val.toString().trim() === "";
}

function checkVerificationDate(row) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const raw = (row["Verification Date"] || "").trim();
  if (raw === "") {
    return { status: "PASS", rule: "Verification Date", message: "" }; // skip empty
  }
  const date = raw.replace(/-/g, "");
  if (date !== today) {
    return {
      status: "FAIL",
      rule: "Verification Date",
      message: "Update Verification date",
    };
  }
  return { status: "PASS", rule: "Verification Date", message: "" };
}

function checkVerificationSource(row) {
  const status = (row["Status"] || "").trim();
  const source = (row["Verification Source"] || "").trim();
  const allowed = {
    "[OP] Open, Operating": [
      "[2] Telephone, Direct",
      "[23] Telephone, Indirect",
      "[40] Web Sites, Other",
      "[42] Web Lookup",
    ],
    "[FO] Future Opening": [
      "[2] Telephone, Direct",
      "[23] Telephone, Indirect",
      "[40] Web Sites, Other",
      "[42] Web Lookup",
    ],
    "[NA] Inactive/Not Verified": ["[13] Special Projects"],
    "[TC] Closed": [
      "[2] Telephone, Direct",
      "[23] Telephone, Indirect",
      "[40] Web Sites, Other",
      "[42] Web Lookup",
      "[34] Attempted Contact Failed",
    ],
    "[UV] Unverifiable": ["[34] Attempted Contact Failed"],
  };
  if (allowed[status] && !allowed[status].includes(source)) {
    return {
      status: "FAIL",
      rule: "Verification Source",
      message: "Incorrect VSS",
    };
  }
  return { status: "PASS", rule: "Verification Source", message: "" };
}

function checkEmMgException(row) {
  const trade = row["Local Trade Channel"] || "";
  const mgName = row["MG Name"] || "";
  const exception = row["Exception Code"] || "";

  if (trade === "[59] Unknown On-Premise") {
    if (mgName.endsWith("/EM")) {
      if (exception !== "777794Z") {
        return {
          status: "FAIL",
          rule: "EM/MG Exception",
          message: `/EM MG must have Exception Code 94Z`
        };
      }
    }
  }

  return { status: "PASS", rule: "EM/MG Exception", message: "" };
}


function checkInactive(row) {
  if (row["Status"] === "[NA] Inactive/Not Verified") {
    if (row["Exception Code"] !== "777798Z") {
      return {
        status: "FAIL",
        rule: "Inactive/Exception",
        message: "Inactive must have Exception Code 98Z"
      };
    }
  }
  return { status: "PASS", rule: "Inactive/Exception", message: "" };
}


function checkUVException(row) {
  if (row["Status"] === "[UV] Unverifiable") {
    if (row["Exception Code"] !== "777793Z")
      return {
        status: "FAIL",
        rule: "UV/Exception",
        message: "UV must have Exception Code 93Z",
      };
    if (row["Verification Source"] !== "[34] Attempted Contact Failed")
      return {
        status: "FAIL",
        rule: "UV/Exception",
        message: "UV with 93Z must have VSS [34] Attempted Contact Failed",
      };
  }
  return { status: "PASS", rule: "UV/Exception", message: "" };
}

function checkUVTrade(row) {
  if (row["Status"] === "[UV] Unverifiable") {
    if (!(row["Local Trade Channel"] === "[09] Unknown Retailers" &&
          row["Local Sub Channel"] === "[X] Retail Other")) {
      return {
        status: "FAIL",
        rule: "UV/Trade",
        message: "UV must be [09] Unknown Retailers / [X] Retail Other"
      };
    }
  }
  return { status: "PASS", rule: "UV/Trade", message: "" };
}


function checkFoodType(row) {
  // Skip completely empty rows
  // if (Object.values(row).every(val => val === null || val === "")) {
  //   return { status: "PASS", rule: "Food Type", message: "" };
  // }

  const status = row["Status"] || "";
  const tradeChannel = row["Local Trade Channel"] || "";
  const subChannel = row["Local Sub Channel"] || "";
  const foodType = row["Food Type"];

  const validTradeChannels = ["[50] Dining", "[51] Bar/Nightclub", "[55] Caterers", ""];
  const validSubChannels = ["[H] Restaurant NA", "[C] Concessionaire NA"];

  if (validTradeChannels.includes(tradeChannel) || validSubChannels.includes(subChannel)) {
    if (isNull(foodType)) {
      if (status === "[OP] Open, Operating" || status === "[FO] Future Opening") {
        return { status: "FAIL", rule: "Food Type", message: "Food Type missing for On Premise TD" };
      } else {
        return { status: "WARN", rule: "Food Type", message: "Food Type missing for On Premise TD" };
      }
    }
  }

  return { status: "PASS", rule: "Food Type", message: "" };
}



function checkPhone(row) {
  const status = row["Status"];
  const phone = row["Phone"];
  const trade = row["Local Trade Channel"];
  if (trade === "[09] Unknown Retailers")
    return { status: "PASS", rule: "Phone", message: "" };
  if (status === "[OP] Open, Operating" && isNull(phone))
    return {
      status: "FAIL",
      rule: "Phone",
      message: "Open TD must have a Ph#",
    };
  if (status === "[FO] Future Opening" && isNull(phone))
    return {
      status: "FAIL",
      rule: "Phone",
      message: "Please verify if Ph# is available",
    };
  return { status: "PASS", rule: "Phone", message: "" };
}

function checkAddress(row) {
  if (row["Address Quality"] === "Non Standardized")
    return {
      status: "WARN",
      rule: "Address Quality",
      message: "Address not standardized",
    };
  return { status: "PASS", rule: "Address Quality", message: "" };
}

// Full names → required abbreviations
const POSTAL_ABBREVIATIONS = {
  "Boulevard": "Blvd",
  "Building": "Bldg",
  "Business Highway": "Bus Hwy",
  "Bypass": "Byp",
  "Causeway": "Cswy",
  "Circle": "Cir",
  "County Road": "Co Rd",
  "Court": "Ct",
  "Drive": "Dr",
  "Expressway": "Expy",
  "Extension": "Ext",
  "Farm To Market": "FM",
  "Freeway": "Fwy",
  "Highway": "Hwy",
  "Interstate": "I",
  "Lane": "Ln",
  "Mount": "Mt",
  "Parkway": "Pkwy",
  "Pike": "Pke",
  "Place": "Pl",
  "Plaza": "Plz",
  "Point": "Pt",
  "Port": "Pt",
  "Route": "Rte",
  "Rural Route": "RR",
  "Square": "Sq",
  "State Highway": "St Hwy",
  "Street": "St",
  "Terrace": "Ter",
  "Trail": "Trl",
  "Turnpike": "Tpke",
  "US Highway": "US Hwy",
  "Wy": "Way"
};

// Full directionals → required abbreviations
const DIRECTIONALS = {
  "North": "N",
  "South": "S",
  "East": "E",
  "West": "W",
  "Northeast": "NE",
  "Southeast": "SE",
  "Northwest": "NW",
  "Southwest": "SW"
};

// Full numbered streets → abbreviations
const NUMBERED_STREETS = {
  "First": "1st",
  "Second": "2nd",
  "Third": "3rd",
  "Fourth": "4th"
};

// Words that need position-sensitive handling
const POSITIONAL_SUFFIXES = {
  "Avenue": "Ave",
  "Lake": "Lk",
  "Center": "Ctr",
  "Park": "Pk"
};

// Unit designators that can appear at the end
const UNIT_DESIGNATORS = ["Ste", "Suite", "Apt", "Unit", "Fl", "Rm", "Bldg", "Dept", "#"];

function getLastStreetWord(parts) {
  // Walk backwards until you find a word that's not a unit designator or number
  for (let i = parts.length - 1; i >= 0; i--) {
    const word = parts[i];
    if (
      !UNIT_DESIGNATORS.includes(word) &&
      !/^\d+$/.test(word) // skip pure numbers
    ) {
      return word.toLowerCase();
    }
  }
  return ""; // fallback
}

function checkAddressRules(row) {
  const address = row["Address"] || "";
  const quality = row["Address Quality"] || "";

  if (quality !== "Non Standardized") {
    return { status: "PASS", rule: "Address Rule", message: "" };
  }

  let errors = [];
  const parts = address.trim().split(/\s+/);
  const lastStreetWord = getLastStreetWord(parts);

  // Rule: Position-sensitive handling
  for (const [full, abbr] of Object.entries(POSITIONAL_SUFFIXES)) {
    // Case 1: Full word at the end → should be abbreviation
    if (lastStreetWord === full.toLowerCase()) {
      errors.push(`"${full}" should be "${abbr}" at the end of the address`);
    }

    // Case 2: Abbreviation in the middle → should be full form
    for (let i = 1; i < parts.length - 1; i++) {
      if (parts[i].toLowerCase() === abbr.toLowerCase()) {
        errors.push(`"${abbr}" should be spelled out as "${full}" in the middle of the address`);
      }
    }
  }

  // Rule 3: All other postal abbreviations (excluding positional ones)
  for (const [full, abbr] of Object.entries(POSTAL_ABBREVIATIONS)) {
    if (POSITIONAL_SUFFIXES[full]) continue; // skip Avenue/Lake/Center/Park
    const regex = new RegExp(`\\b${full}\\b`, "i");
    if (regex.test(address)) {
      errors.push(`"${full}" should be "${abbr}"`);
    }
  }

  // Rule 4: Directionals
  for (const [full, abbr] of Object.entries(DIRECTIONALS)) {
    const regex = new RegExp(`\\b${full}\\b`, "i");
    if (regex.test(address)) {
      errors.push(`"${full}" should be "${abbr}"`);
    }
  }

  // Rule 5: Numbered streets
  for (const [full, abbr] of Object.entries(NUMBERED_STREETS)) {
    const regex = new RegExp(`\\b${full}\\b`, "i");
    if (regex.test(address)) {
      errors.push(`"${full}" should be "${abbr}"`);
    }
  }

  if (errors.length > 0) {
    return { status: "FAIL", rule: "Address Rule", message: errors.join("; ") };
  }

  return { status: "PASS", rule: "Address Rule", message: "" };
}



function checkNameFormat(row) {
  const name = (row["Name"] || "").trim();
  if (!name) return { status: "PASS", rule: "Name Format", message: "" };
  const words = name.split(" ");
  for (let word of words) {
    if (word === "&") continue;
    if (/^\d/.test(word)) continue;
    if (word.toUpperCase() === word) continue;
    if (word.length === 1 && word !== word.toUpperCase())
      return {
        status: "FAIL",
        rule: "Name Format",
        message: `Name formatting incorrect: ${name}`,
      };
    if (
      word.length > 1 &&
      !(
        word[0] === word[0].toUpperCase() &&
        word.slice(1) === word.slice(1).toLowerCase()
      )
    ) {
      return {
        status: "FAIL",
        rule: "Name Format",
        message: `Name formatting incorrect: ${name}`,
      };
    }
  }
  return { status: "PASS", rule: "Name Format", message: "" };
}

// supplier list - c-store = Grocery Supplier & Confection Supplier || mass merchandise = Grocery supplier, confection supplier, GM supplier and HBC Supplier ||
// Grocery = all suppliers

function nullSupplier(row) {
  const grocerysupp = (row["Grocery Supplier Number"] || "").trim();
  const confectionsupp = (row["Confection Supplier Number"] || "").trim();
  const gmsupp = (row["GM Supplier Number"] || "").trim();
  const hbcsupp = (row["HBC Supplier Number"] || "").trim();
  const frozensupp = (row["Frozen Supplier Number"] || "").trim();
  const trade = (row["Local Trade Channel"] || "").trim();

  const mgLocalCode = (row["MG Local Code"] || "").trim();
  const irtLocalCode = (row["IRT Local Code"] || "").trim();

  // ✅ Guard clause: only run if at least one of MG or IRT Local Code is present
  if (!mgLocalCode && !irtLocalCode) {
    return { status: "PASS", rule: "Null Supplier", message: "" };
  }

  // Helper: check if a supplier field is empty
  const isEmpty = (val) => !val;

  switch (trade) {
    case "[07] Convenience Stores":
      if (isEmpty(grocerysupp) || isEmpty(confectionsupp)) {
        return {
          status: "FAIL",
          rule: "Null Supplier",
          message: "Convenience Stores require Grocery & Confection suppliers",
        };
      }
      break;

    case "[08] Mass Merchandise Stores":
      if (
        isEmpty(grocerysupp) ||
        isEmpty(confectionsupp) ||
        isEmpty(gmsupp) ||
        isEmpty(hbcsupp)
      ) {
        return {
          status: "FAIL",
          rule: "Null Supplier",
          message:
            "Mass Merchandise requires Grocery, Confection, GM & HBC suppliers",
        };
      }
      break;

    case "[05] Grocery Stores":
      if (
        isEmpty(grocerysupp) ||
        isEmpty(confectionsupp) ||
        isEmpty(gmsupp) ||
        isEmpty(hbcsupp) ||
        isEmpty(frozensupp)
      ) {
        return {
          status: "FAIL",
          rule: "Null Supplier",
          message: "Grocery Stores require all supplier fields",
        };
      }
      break;

    default:
      return { status: "PASS", rule: "Null Supplier", message: "" };
  }

  return { status: "PASS", rule: "Null Supplier", message: "" };
}

function incorrectSupplier(row) {
  const grocerysupp = (row["Grocery Supplier Number"] || "").trim();
  const confectionsupp = (row["Confection Supplier Number"] || "").trim();
  const gmsupp = (row["GM Supplier Number"] || "").trim();
  const hbcsupp = (row["HBC Supplier Number"] || "").trim();
  const frozensupp = (row["Frozen Supplier Number"] || "").trim();
  const trade = (row["Local Trade Channel"] || "").trim();

  // Helper: check if any supplier field is populated
  const hasSupplier =
    grocerysupp || confectionsupp || gmsupp || hbcsupp || frozensupp;

  // ✅ Allowed trades
  const allowedTrades = [
    "[07] Convenience Stores",
    "[08] Mass Merchandise Stores",
    "[05] Grocery Stores",
  ];

  // ❌ If trade is not allowed but suppliers exist → FAIL
  if (!allowedTrades.includes(trade) && hasSupplier) {
    return {
      status: "FAIL",
      rule: "Incorrect Supplier",
      message: `Trade ${trade} should not have any supplier fields populated`,
    };
  }

  // ✅ Otherwise → PASS
  return { status: "PASS", rule: "Incorrect Supplier", message: "" };
}

// Export rules
const rules = [
  checkVerificationDate,
  checkVerificationSource,
  checkEmMgException,
  checkInactive,
  checkUVException,
  checkUVTrade,
  checkFoodType,
  checkPhone,
  checkAddressRules,
  checkAddress,
  checkNameFormat,
  nullSupplier,
  incorrectSupplier,
];
