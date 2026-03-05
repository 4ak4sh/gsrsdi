// Utility
function isNull(value) {
  return value === null || String(value).trim() === "";
}

// --- Validation Rules (translated from Python) ---
function checkVerificationDate(row) {
  const today = new Date().toISOString().slice(0,10).replace(/-/g,"");
  const date = (row["Verification Date"]||"").replace(/-/g,"");
  if (date !== today) return {status:"FAIL", rule:"Verification Date", message:"Update Verification date"};
  return {status:"PASS", rule:"Verification Date", message:""};
}

function checkVerificationSource(row) {
  const status = (row["Status"]||"").trim();
  const source = (row["Verification Source"]||"").trim();
  const allowed = {
    "[OP] Open, Operating": ["[2] Telephone, Direct","[23] Telephone, Indirect","[40] Web Sites, Other","[42] Web Lookup"],
    "[FO] Future Opening": ["[2] Telephone, Direct","[23] Telephone, Indirect","[40] Web Sites, Other","[42] Web Lookup"],
    "[NA] Inactive/Not Verified": ["[13] Special Projects"],
    "[TC] Closed": ["[2] Telephone, Direct","[23] Telephone, Indirect","[40] Web Sites, Other","[42] Web Lookup","[34] Attempted Contact Failed"],
    "[UV] Unverifiable": ["[34] Attempted Contact Failed"]
  };
  if (allowed[status] && !allowed[status].includes(source)) {
    return {status:"FAIL", rule:"Verification Source", message:"Incorrect VSS"};
  }
  return {status:"PASS", rule:"Verification Source", message:""};
}

function checkUVException(row) {
  if (row["Status"] === "[UV] Unverifiable") {
    if (row["Exception Code"] !== "777793Z") return {status:"FAIL", rule:"UV/Exception", message:"UV must have Exception Code 93Z"};
    if (row["Verification Source"] !== "[34] Attempted Contact Failed") return {status:"FAIL", rule:"UV/Exception", message:"UV with 93Z must have VSS [34] Attempted Contact Failed"};
  }
  return {status:"PASS", rule:"UV/Exception", message:""};
}

function checkInactive(row) {
  if (row["Status"] === "[NA] Inactive/Not Verified" && row["Verification Source"] !== "[13] Special Projects") {
    return {status:"FAIL", rule:"Inactive", message:"Inactive must have Special Projects as VSS"};
  }
  return {status:"PASS", rule:"Inactive", message:""};
}

function checkFoodType(row) {
  if (["[50] Dining","[51] Bar/Nightclub","[55] Caterers",""].includes(row["Local Trade Channel"]) ||
      ["[H] Restaurant NA","[C] Concessionaire NA"].includes(row["Local Sub Channel"])) {
    if (isNull(row["Food Type"])) return {status:"FAIL", rule:"Food Type", message:"Food Type missing for On Premise TD"};
  }
  return {status:"PASS", rule:"Food Type", message:""};
}

function checkPhone(row) {
  const status = row["Status"];
  const phone = row["Phone"];
  const trade = row["Local Trade Channel"];
  if (trade === "[09] Unknown Retailers") return {status:"PASS", rule:"Phone", message:""};
  if (status === "[OP] Open, Operating" && isNull(phone)) return {status:"FAIL", rule:"Phone", message:"Open TD must have a Ph#"};
  if (status === "[FO] Future Opening" && isNull(phone)) return {status:"FAIL", rule:"Phone", message:"Please verify if Ph# is available"};
  return {status:"PASS", rule:"Phone", message:""};
}

function checkAddress(row) {
  if (row["Address Quality"] === "Non Standardized") return {status:"WARNING", rule:"Address", message:"Address not standardized"};
  return {status:"PASS", rule:"Address", message:""};
}

function checkNameFormat(row) {
  const name = (row["Name"]||"").trim();
  if (!name) return {status:"PASS", rule:"Name Format", message:""};
  const words = name.split(" ");
  for (let word of words) {
    if (word === "&") continue;
    if (/^\d/.test(word)) continue;
    if (word.toUpperCase() === word) continue;
    if (word.length === 1 && word !== word.toUpperCase()) return {status:"FAIL", rule:"Name Format", message:`Name formatting incorrect: ${name}`};
    if (word.length > 1 && !(word[0] === word[0].toUpperCase() && word.slice(1) === word.slice(1).toLowerCase())) {
      return {status:"FAIL", rule:"Name Format", message:`Name formatting incorrect: ${name}`};
    }
  }
  return {status:"PASS", rule:"Name Format", message:""};
}

// Rule list
const RULES = [
  checkVerificationDate,
  checkVerificationSource,
  checkUVException,
  checkInactive,
  checkFoodType,
  checkPhone,
  checkAddress,
  checkNameFormat
];

// --- CSV Parsing ---
function parseCSV(text) {
  const lines = text.split("\n").filter(l => l.trim() !== "");
  const headers = lines[0].split(",");
  return lines.slice(1).map(line => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h,i) => obj[h.trim()] = values[i] ? values[i].trim() : "");
    return obj;
  });
}

// --- Group results by rule ---
function validateByRule(rows) {
  const categorized = {};
  rows.forEach((row,i) => {
    RULES.forEach(rule => {
      const res = rule(row);
      if (res.status !== "PASS") {
        if (!categorized[res.rule]) categorized[res.rule] = [];
        categorized[res.rule].push({
          row:i+2,
          ...res,
          name:row["Name"],
          address:row["Address"],
          city:row["City"],
          state:row["State"],
          phone:row["Phone"]
        });
      }
    });
  });
  return categorized;
}

// --- Display Tabs ---
function displayTabs(categorized) {
  const tabContainer = document.getElementById("tab-container");
  const tabContent = document.getElementById("tab-content");
  tabContainer.innerHTML = "";
  tabContent.innerHTML = "";

  const rules = Object.keys(categorized);
  if (rules.length === 0) {
    tabContent.innerHTML = "<p>No discrepancies found!</p>";
    return;
  }

  rules.forEach((ruleName, idx) => {
    const tab = document.createElement("div");
    tab.className = "tab" + (idx===0 ? " active" : "");
    tab.textContent = `${ruleName} (${categorized[ruleName].length})`;
    tab.onclick = () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      showTable(ruleName, categorized[ruleName]);
    };
    tabContainer.appendChild(tab);
  });

  // Show first tab by default
  showTable(rules[0], categorized[rules[0]]);
}

// --- Show Table for a Rule ---
function showTable(ruleName, defects) {
  const tabContent = document.getElementById("tab-content");
  tabContent.innerHTML = `<h3>${ruleName} - ${defects.length} issues</h3>`;
  const table = document.createElement("table");
  const headerRow = document.createElement("tr");
  ["Row","Status","Message","Name","Address","City","State","Phone"].forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  defects.forEach(r => {
    const tr = document.createElement("tr");
    [r.row, r.status, r.message, r.name, r.address, r.city, r.state, r.phone].forEach(val => {
      const td = document.createElement("td");
      td.textContent = val;
      tr.appendChild(td);
    });
    // Color coding
    if (r.status === "FAIL") tr.style.backgroundColor = "#f8d7da";   // light red
    if (r.status === "WARNING") tr.style.backgroundColor = "#fff3cd"; // light yellow
    table.appendChild(tr);
  });

  tabContent.appendChild(table);
}

// --- Main Validation Trigger ---
function runValidation() {
  const fileInput = document.getElementById("csvFile");
  const file = fileInput.files[0];
  if (!file) return alert("Please upload a CSV file");

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const rows = parseCSV(text);
    const categorized = validateByRule(rows);
    displayTabs(categorized);
    document.getElementById("status-left").textContent = `Total rules with issues: ${Object.keys(categorized).length}`;
  };
  reader.readAsText(file);
}

function exitApp() {
  alert("Exit button clicked — in a real deployment this would close the app.");
}
