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

function checkIncorrectStatus(row) {
  const trade = (row["Local Trade Channel"] || "").trim();
  const status = (row["Status"] || "").trim();

  // ✅ Rule: If trade is [09] or [59], status must not be FO
  if ((trade === "[09] Unknown Retailers" || trade === "[59] Unknown On-Premise") 
      && status === "[FO] Future Opening") {
    return {
      status: "FAIL",
      rule: "Incorrect Status",
      message: `Trade ${trade} cannot have status ${status}`
    };
  }

  return { status: "PASS", rule: "Incorrect Status", message: "" };
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

  if (trade === "[09] Unknown Retailers") {
    return { status: "PASS", rule: "Phone", message: "" };
  }

  if (status === "[OP] Open, Operating" && isNull(phone)) {
    return {
      status: "FAIL",   // 🔴 your table builder already maps FAIL → red
      rule: "Phone",
      message: "Open TD must have a Ph#"
    };
  }

  if (status === "[FO] Future Opening" && isNull(phone)) {
    return {
      status: "WARN",   // 🟡 your table builder already maps WARN → yellow
      rule: "Phone",
      message: "Please verify if Ph# is available"
    };
  }

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


function nullStoreNumber(row) {
  const irt = (row["IRT Local Code"] || "").trim();
  const mg = (row["MG Local Code"] || "").trim();
  const storeNum = (row["Store Number"] || "").trim();

  // Case 1: Store Number is all zeros → FAIL (always)
  if (/^0+$/.test(storeNum)) {
    return {
      status: "FAIL",
      rule: "Store Number",
      message: "Store Number cannot be all zeros"
    };
  }

  // Case 2: Both MG and IRT are missing
  if (!mg && !irt) {
    if (!storeNum) {
      // No MG/IRT and no store number → PASS
      return { status: "PASS", rule: "Store Number", message: "" };
    } else {
      // No MG/IRT but store number present → PASS (optional, depends on business rules)
      return { status: "PASS", rule: "Store Number", message: "" };
    }
  }

  // Case 3: MG/IRT exists but Store Number is empty → FAIL
  if (!storeNum) {
    return {
      status: "FAIL",
      rule: "Store Number",
      message: "Store Number is missing while MG or IRT code is present"
    };
  }

  // Case 4: MG/IRT exists and Store Number is valid → PASS
  return { status: "PASS", rule: "Store Number", message: "" };
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

      case "[01] Wholesale Clubs":
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
          message: "Wholesale Clubs require all supplier fields",
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

  const irt = (row["IRT Local Code"] || "").trim();
  const mg = (row["MG Local Code"] || "").trim();
  const trade = (row["Local Trade Channel"] || "").trim();
  const channel = (row["Local Sub Channel"] || "").trim();

  // Helper: check if any supplier field is populated
  const hasSupplier =
    grocerysupp || confectionsupp || gmsupp || hbcsupp || frozensupp;

  // ✅ Allowed trades
  const allowedTrades = [
    "[01] Wholesale Clubs",
    "[05] Grocery Stores",
    "[07] Convenience Stores",
    "[08] Mass Merchandise Stores",
    "[11] Pet"
  ];

  // ✅ Allowed sub‑channels for Pet
  const allowedPetChannel = "[1] Pet Super Store";

  // --- Step 1: IRT/MG rule ---
  if (!irt && !mg) {
    if (hasSupplier) {
      return {
        status: "FAIL",
        rule: "Incorrect Supplier",
        message: "Suppliers must not be populated when both IRT and MG are empty",
      };
    }
    return { status: "PASS", rule: "Incorrect Supplier", message: "" };
  }

  // --- Step 2: Trade/Channel rule ---
  if (trade === "[09] Pet Stores") {
    if (channel !== "[1] Pet Super Store" && hasSupplier) {
      return {
        status: "FAIL",
        rule: "Incorrect Supplier",
        message: `Pet Stores with channel ${channel} should not have supplier fields populated`,
      };
    }
  } else if (!allowedTrades.includes(trade) && hasSupplier) {
      return {
        status: "FAIL",
        rule: "Incorrect Supplier",
        message: `Trade ${trade} should not have supplier fields populated`,
      };
    }

    return { status: "PASS", rule: "Incorrect Supplier", message: "" };
}


// BWL State Law
// trade channels

const wholesale = "[01] Wholesale Clubs"
const liq = "[02] Liquor, Wine and Beer Stores"
const drug = "[03] Drug Stores and Pharmacies"
const cigarette = "[04] Cigarette Stores"
const grocery = "[05] Grocery Stores"
const catkiller = "[06] Category Killers"
const cstore = "[07] Convenience Stores"
const mass = "[08] Mass Merchandise Stores"
const cannabis = "[14] Cannabis"


// Restrictive states only
const stateAlcoholRules = {
AK: {
    beer: [liq],
    wine: [liq],
    liquor: [liq]
},

AL: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [liq]
},

AR: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [cigarette, grocery, cstore, mass, liq],
    liquor: [cigarette, liq]
},

CO: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [grocery,drug, liq]
},

CT: {
    beer: [wholesale, drug, cstore, grocery, liq],
    wine: [drug, liq],
    liquor: [drug, liq]
},

DC: {
    beer: [wholesale, drug, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, grocery, catkiller, cstore, mass, liq],
    liquor: [wholesale, liq]
},

DE: {
    beer: [liq],
    wine: [liq],
    liquor: [liq]
},

FL: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [cigarette, grocery, catkiller, cstore, liq]
},

GA: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [liq]
},

HI: {
  beer: [wholesale, drug, grocery, catkiller, cstore, mass, liq],
  wine: [wholesale, drug, grocery, catkiller, cstore, mass, liq],
  liquor: [wholesale, drug, grocery, cstore, mass, liq]
},

// IA: {
//     beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
//     wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
//     liquor: [wholesale, drug, cigarette, grocery, cstore, mass, liq]
// },

ID: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [cstore, liq]
},

IN: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [wholesale, drug, cigarette, grocery, cstore, mass, liq]
},

KS: {
    beer: [wholesale, drug, cigarette, grocery, cstore, mass, liq],
    wine: [liq, cigarette],
    liquor: [liq, cigarette]
},

KY: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, catkiller, liq, mass],
    liquor: [drug, cigarette, liq]
},

MA: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [wholesale, drug, cigarette, grocery, cstore, mass, liq]
},

MD: {
    beer: [wholesale, drug, cigarette, grocery, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, mass, liq],
    liquor: [wholesale, drug, cigarette, grocery, mass, liq]
},

ME: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [drug, cigarette, grocery, cstore, liq]
},

MN: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [cigarette, catkiller, liq],
    liquor: [liq, cigarette]  
},

MO: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [wholesale, drug, cigarette, grocery, cstore, catkiller, liq]
},

MS: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [liq, drug, cigarette, catkiller],
    liquor: [liq, cigarette]
},

MT: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, grocery, catkiller, cstore, mass, liq],
    liquor: [liq]
},

NC: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [liq]
},

ND: {
    beer: [wholesale, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, grocery, cstore, mass, liq],
    liquor: [wholesale, grocery, cstore, liq]
},

// NE: {
//     beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
//     wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
//     liquor: [drug, grocery, catkiller, cstore, mass, liq]   
// },

NH: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [liq]
},

NJ: {
    beer: [wholesale, drug, cigarette, grocery, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, cstore, mass, liq],
    liquor: [wholesale, drug, cigarette, grocery, cstore, mass, liq]
},

NM: {
  beer:[wholesale, drug, grocery, catkiller, cstore, mass, liq],
  wine:[wholesale, drug, grocery, catkiller, cstore, mass, liq],
  liquor: [wholesale, drug, grocery, catkiller, cstore, mass, liq]
},

NY: {
    beer: [drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [liq, cigarette, grocery, cstore],
    liquor: [liq]
},

// OH: {
//     beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
//     wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
//     liquor: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq]
// },

OK: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, cstore, mass, liq],
    liquor: [liq]
},

OR: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [liq]
},

PA: {
    beer: [liq],
    wine: [liq],
    liquor: [liq]
},

RI: {
    beer: [liq],
    wine: [liq],
    liquor: [liq]
},

SC: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [cstore, cigarette, liq]
},

TN: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [liq]
},

TX: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [liq]
},

UT: {
    beer: [wholesale, drug, cigarette, grocery, cstore, mass, liq],
    wine: [liq],
    liquor: [liq]
},

VA: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [cstore, liq]
},

VT: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [liq]
},

WV: {
    beer: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, catkiller, cstore, mass, liq],
    liquor: [wholesale, drug, cigarette, grocery, cstore, liq]
},

WY: {
    beer: [wholesale, drug, cigarette, grocery, cstore, mass, liq],
    wine: [wholesale, drug, cigarette, grocery, cstore, mass, liq],
    liquor: [wholesale, drug, cigarette, grocery, cstore, mass, liq]
}
};


function checkStateAlcoholLaw(row) {
  function getStateCode(stateField) {
    const match = (stateField || "").match(/\[(\w{2})\]/);
    return match ? match[1] : null;
  }

  const stateCode = getStateCode(row["State"]);
  const channel = (row["Local Trade Channel"] || "").trim();
  const beerFlag = row["Beer"] === "[Y] Yes";
  const wineFlag = row["Wine"] === "[Y] Yes";
  const liquorFlag = row["Liquor"] === "[Y] Yes";

  // ✅ Only check these trades
  const tradesToCheck = [
    "[01] Wholesale Clubs",
    "[02] Liquor, Wine and Beer Stores",
    "[03] Drug Stores and Pharmacies",
    "[04] Cigarette Stores",
    "[05] Grocery Stores",
    "[06] Category Killers",
    "[07] Convenience Stores",
    "[08] Mass Merchandise Stores",
    "[14] Cannabis"
  ];

  if (!tradesToCheck.includes(channel)) {
    return { status: "PASS", rule: "BWL State Law", message: "Trade not subject to alcohol law check" };
  }

  if (!stateCode) {
    return { status: "PASS", rule: "BWL State Law", message: "No state code found" };
  }

  const rules = stateAlcoholRules[stateCode];
  if (!rules) {
    return { status: "PASS", rule: "BWL State Law", message: `No rules defined for ${stateCode}` };
  }

  let violations = [];
  if (beerFlag && !rules.beer.includes(channel)) {
    violations.push(`Beer not allowed in ${channel} for ${stateCode}`);
  }
  if (wineFlag && !rules.wine.includes(channel)) {
    violations.push(`Wine not allowed in ${channel} for ${stateCode}`);
  }
  if (liquorFlag && !rules.liquor.includes(channel)) {
    violations.push(`Liquor not allowed in ${channel} for ${stateCode}`);
  }

  if (violations.length > 0) {
    return {
      status: "FAIL",
      rule: "BWL State Law",
      message: violations.join("; ")
    };
  }

  return { status: "PASS", rule: "BWL State Law", message: "" };
}




// Export rules
const rules = [
  checkVerificationDate,
  checkIncorrectStatus,
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
  nullStoreNumber,
  nullSupplier,
  incorrectSupplier,
  checkStateAlcoholLaw
];
