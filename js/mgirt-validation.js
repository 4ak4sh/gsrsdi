window.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("mgStatus");
  const mgIrtFile = document.getElementById("mgIrtFile");
  const runValidationBtn = document.getElementById("runValidation");
  const clearValidationBtn = document.getElementById("mgIrtclearBtn");
  const resultsContainer = document.getElementById("validationResults");

  // ✅ Initialize Supabase
  const supabase = window.supabase.createClient(
    "https://ogfmgeonxxsjnkxpmrdr.supabase.co",
    "sb_publishable_C7dnz0Y4hzyM8gtSXdp5ig_WLfOHiox"
  );

  // ✅ Normalizers
  function normalizeName(name) {
    return (name || "")
      .toLowerCase()
      .replace(/\s*&\s*/g, " and ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function normalizeCode(code) {
    return (code || "").toString().trim();
  }

  // ✅ Load ALL MG/IRT data with pagination
  async function loadAllMgIrtData() {
    let allData = [];
    let from = 0;
    const pageSize = 1000;
    let done = false;

    while (!done) {
      const { data, error } = await supabase
        .from("mg_irt_cache")
        .select("*")
        .range(from, from + pageSize - 1);

      if (error) {
        console.error("Error loading MG/IRT data:", error);
        break;
      }

      if (!data || data.length === 0) {
        done = true;
      } else {
        allData = allData.concat(data);
        from += pageSize;
      }
    }

    return allData;
  }

  async function loadMgIrtDataFromSupabase() {
    const data = await loadAllMgIrtData();
    if (data && data.length > 0) {
      statusEl.innerHTML =
        `<span class="badge bg-success rounded-pill"><i class="bi bi-check-circle-fill me-1"></i>MG & IRT list loaded from database (${data.length} records)</span>`;
      return data;
    } else {
      statusEl.innerHTML =
        '<span class="badge bg-warning text-dark rounded-pill"><i class="bi bi-exclamation-circle-fill me-1"></i>No MG & IRT data in database! Please upload your file</span>';
      return null;
    }
  }

  // ✅ Load MG/IRT data once at page load
  let mgIrtData = await loadMgIrtDataFromSupabase();

  // ✅ Allow user upload as override
  mgIrtFile.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        complete: (r) => {
          statusEl.innerHTML =
            '<span class="badge bg-success rounded-pill"><i class="bi bi-check-circle-fill me-1"></i>Using uploaded MG & IRT file</span>';
          runMgIrtValidation(document.getElementById("diFile").files[0], r.data, resultsContainer);
        },
      });
    }
  });

  // ✅ Run MG & IRT validation
  runValidationBtn.addEventListener("click", async () => {
    const diFile = document.getElementById("diFile").files[0];
    if (!diFile) {
      alert("Please upload the DI file.");
      return;
    }
    if (diFile.type !== "text/csv" && !diFile.name.endsWith(".csv")) {
      alert("Invalid file type. Please upload a CSV file.");
      return;
    }

    // ✅ Reset modal body to spinner before showing
    const modalBody = document.querySelector("#verifyModal .modal-body");
    modalBody.innerHTML = `
      <div class="d-flex align-items-center">
        <div class="spinner-border text-primary me-2" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <span>Matching DI file against MG/IRT database...</span>
      </div>
    `;

    // ✅ Remove any old close button
    const modalHeader = document.querySelector("#verifyModal .modal-header");
    const oldClose = modalHeader.querySelector(".btn-close");
    if (oldClose) oldClose.remove();

    // ✅ Open modal
    const modal = new bootstrap.Modal(document.getElementById("verifyModal"));
    modal.show();

    // ✅ Always refresh MG/IRT data before validation
    const mgIrtData = await loadMgIrtDataFromSupabase();
    if (!mgIrtData) {
      alert("MG & IRT data not available. Please upload or check database.");
      return;
    }

    
      
    // Run validation
      Papa.parse(diFile, {
        header: true,
        complete: (r) => {
          const diData = r.data;
          let matches = [];

          // Build lookup maps
          const mgMapByName = new Map();
          const mgMapByCode = new Map();

          mgIrtData.forEach((row) => {
            const normName = normalizeName(row["ACCOUNT_NAME"]);
            const normCode = normalizeCode(row["TDLINX_ACCOUNT_CODE"]);
            if (normName) mgMapByName.set(normName, row);
            if (normCode) mgMapByCode.set(normCode, row);
          });

          diData.forEach((diRow) => {
            const diName = (diRow["Name"] || "").trim();
            const diNameNorm = normalizeName(diName);
            const mgLocalCodeNorm = normalizeCode(diRow["MG Local Code"]);
            const irtLocalCode = (diRow["IRT Local Code"] || "").trim();

            // Case A: Both MG + IRT missing → match by name
            if (!mgLocalCodeNorm && !irtLocalCode && diNameNorm && mgMapByName.has(diNameNorm)) {
              const mgRow = mgMapByName.get(diNameNorm);
              if (mgRow["ACC_IMMEDIATE_REPORT_TO"]) { // skip if null
                matches.push({
                  diId: diRow["Local Code"],
                  diName,
                  diStatus: diRow["Status"],
                  mgName: mgRow["ACCOUNT_NAME"],
                  mgId: mgRow["TDLINX_ACCOUNT_CODE"],
                  irtId: mgRow["ACC_IMMEDIATE_REPORT_TO"],
                });
              }
            }

            // Case B: MG present but IRT missing → lookup by MG code, fallback by name
            else if (mgLocalCodeNorm && !irtLocalCode) {
              const mgRowByCode = mgMapByCode.get(mgLocalCodeNorm);
              const mgRowByName = mgMapByName.get(diNameNorm);
              const mgRow = mgRowByCode || mgRowByName;

              if (mgRow && mgRow["ACC_IMMEDIATE_REPORT_TO"]) { // skip if null
                matches.push({
                  diId: diRow["Local Code"],
                  diName,
                  diStatus: diRow["Status"],
                  mgName: mgRow["ACCOUNT_NAME"],
                  mgId: mgRow["TDLINX_ACCOUNT_CODE"],
                  irtId: mgRow["ACC_IMMEDIATE_REPORT_TO"],
                });
              }
            }
          });

          setTimeout(()=> {
            // ✅ Update modal body after results
            modalBody.innerHTML = `
              Matches are based on comparison only. Please confirm the business’s official website before updating MG & IRT in TD.
            `;

            // ✅ Add close button dynamically
            if (!modalHeader.querySelector(".btn-close")) {
              const closeBtn = document.createElement("button");
              closeBtn.type = "button";
              closeBtn.className = "btn-close";
              closeBtn.setAttribute("data-bs-dismiss", "modal");
              modalHeader.appendChild(closeBtn);
            }

            // ✅ Render results table outside modal
            resultsContainer.innerHTML = buildResultsTable(matches);
          }, 1000);
        },
      });
  });

  // ✅ Clear button logic
  clearValidationBtn.addEventListener("click", async () => {
    document.getElementById("diFile").value = "";
    mgIrtFile.value = "";
    document.getElementById("mgIrtCardHead").classList.remove("bg-primary");
    document.getElementById("mgIrtCardHead").classList.add("bg-secondary");
    resultsContainer.innerHTML = "Upload DI file and click validate to display matches";
  });

  // ✅ Table builder
  function buildResultsTable(matches) {
    document.getElementById("mgIrtCardHead").classList.remove("bg-secondary");
    document.getElementById("mgIrtCardHead").classList.add("bg-primary");

    return `
      <table class="table table-bordered table-striped mt-3">
        <thead class="table-light">
          <tr>
            <th>Local Code (DI)</th>
            <th>Name (DI)</th>
            <th>Store Status</th>
            <th>MG/IRT Account Name</th>
            <th>MG Account ID</th>
            <th>IRT Account ID</th>
          </tr>
        </thead>
        <tbody>
          ${
            matches.length
              ? matches.map(m => `
                <tr class="table-warning">
                  <td>${m.diId}</td>
                  <td>${m.diName}</td>
                  <td>${m.diStatus}</td>
                  <td>${m.mgName}</td>
                  <td>${m.mgId}</td>
                  <td>${m.irtId}</td>
                </tr>`).join("")
              : `<tr><td colspan="6" class="text-center">No matches found</td></tr>`
          }
        </tbody>
      </table>
    `;
  }
});
