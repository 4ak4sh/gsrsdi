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

// function checkInactive(row) {
//   if (
//     row["Status"] === "[NA] Inactive/Not Verified" &&
//     row["Verification Source"] !== "[13] Special Projects"
//   ) {
//     return {
//       status: "FAIL",
//       rule: "Inactive",
//       message: "Inactive must have Special Projects as VSS",
//     };
//   }
//   return { status: "PASS", rule: "Inactive", message: "" };
// }

function checkFoodType(row) {
  if (
    ["[50] Dining", "[51] Bar/Nightclub", "[55] Caterers", ""].includes(
      row["Local Trade Channel"],
    ) ||
    ["[H] Restaurant NA", "[C] Concessionaire NA"].includes(
      row["Local Sub Channel"],
    )
  ) {
    if (isNull(row["Food Type"]))
      return {
        status: "FAIL",
        rule: "Food Type",
        message: "Food Type missing for On Premise TD",
      };
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
      status: "WARNING",
      rule: "Address",
      message: "Address not standardized",
    };
  return { status: "PASS", rule: "Address", message: "" };
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
  checkUVException,
  checkFoodType,
  checkPhone,
  checkAddress,
  checkNameFormat,
  nullSupplier,
  incorrectSupplier,
];
