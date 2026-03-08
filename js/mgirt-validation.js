let cachedMgIrtData = null;

window.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("mgStatus");
  const mgIrtFile = document.getElementById("mgIrtFile");
  const runValidationBtn = document.getElementById("runValidation");
  const clearValidationBtn = document.getElementById("mgIrtclearBtn"); // ✅ new button
  const resultsContainer = document.getElementById("validationResults");

  // ✅ Initialize Supabase
  const supabase = window.supabase.createClient(
    "https://ogfmgeonxxsjnkxpmrdr.supabase.co",
    "sb_publishable_C7dnz0Y4hzyM8gtSXdp5ig_WLfOHiox"
  );

  // ✅ Load MG/IRT data from Supabase
  async function loadMgIrtDataFromSupabase() {
    const { data, error } = await supabase.from("mg_irt_cache").select("*");
    if (error) {
      console.error("Error loading MG/IRT data:", error);
      statusEl.innerHTML =
        '<span class="badge bg-danger rounded-pill"><i class="bi bi-x-circle-fill me-1"></i>Error loading MG & IRT list from database! Please upload your file</span>';
      return null;
    }
    if (data && data.length > 0) {
      statusEl.innerHTML =
        '<span class="badge bg-success rounded-pill"><i class="bi bi-check-circle-fill me-1"></i>MG & IRT list loaded from database</span>';
      return data;
    } else {
      statusEl.innerHTML =
        '<span class="badge bg-warning text-dark rounded-pill"><i class="bi bi-exclamation-circle-fill me-1"></i>No MG & IRT data in database! Please upload your file</span>';
      return null;
    }
  }

  // ✅ Normalize names
  function normalizeName(name) {
    return (name || "")
      .toLowerCase()
      .replace(/\s*&\s*/g, " and ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ✅ Load Supabase data on page load
  cachedMgIrtData = await loadMgIrtDataFromSupabase();

  // ✅ Allow user upload as override
  mgIrtFile.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        complete: (r) => {
          cachedMgIrtData = r.data;
          statusEl.innerHTML =
            '<span class="badge bg-success rounded-pill"><i class="bi bi-check-circle-fill me-1"></i>Using uploaded MG & IRT file</span>';
        },
      });
    }
  });

  // ✅ Run MG & IRT validation
  runValidationBtn.addEventListener("click", () => {
    const diFile = document.getElementById("diFile").files[0];
    if (!diFile) {
      alert("Please upload the DI file.");
      return;
    }
    if (diFile.type !== "text/csv" && !diFile.name.endsWith(".csv")) {
      alert("Invalid file type. Please upload a CSV file.");
      this.value = ""; // reset input
      return;
    }
    if (cachedMgIrtData) {
      runMgIrtValidation(diFile, cachedMgIrtData, resultsContainer);
    } else {
      alert("MG & IRT data not available. Please upload or check database.");
    }
  });

  // ✅ Clear button logic
  clearValidationBtn.addEventListener("click", async () => {
    // Reset file inputs
    document.getElementById("diFile").value = "";
    mgIrtFile.value = "";

    // Change card header color
    document.getElementById("mgIrtCardHead").classList.remove("bg-primary")
    document.getElementById("mgIrtCardHead").classList.add("bg-secondary")

    // Clear results
    resultsContainer.innerHTML = "Upload DI file and click validate to display matches";

    // Reload MG/IRT data from database
    cachedMgIrtData = await loadMgIrtDataFromSupabase();
  });

  function runMgIrtValidation(diFile, mgIrtData, resultsContainer) {

    document.getElementById("mgIrtCardHead").classList.remove("bg-secondary")
    document.getElementById("mgIrtCardHead").classList.add("bg-primary")

    Papa.parse(diFile, {
      header: true,
      complete: (r) => {
        const diData = r.data;
        let matches = [];

        const mgMap = new Map();
        mgIrtData.forEach((mgRow) => {
          const mgNameNorm = normalizeName(mgRow["ACCOUNT_NAME"]);
          if (mgNameNorm) {
            mgMap.set(mgNameNorm, {
              mgName: mgRow["ACCOUNT_NAME"] || "",
              mgId: mgRow["TDLINX_ACCOUNT_CODE"] || "",
              irtId: mgRow["ACC_IMMEDIATE_REPORT_TO"] || "",
            });
          }
        });

        diData.forEach((diRow) => {
          const diName = (diRow["Name"] || "").trim();
          const mgLocalCode = (diRow["MG Local Code"] || "").trim();
          const irtLocalCode = (diRow["IRT Local Code"] || "").trim();

          if (!diName || (mgLocalCode && irtLocalCode)) return;

          const diNameNorm = normalizeName(diName);

          if (mgMap.has(diNameNorm)) {
            const { mgName, mgId, irtId } = mgMap.get(diNameNorm);
            matches.push({
              diId: diRow["Local Code"] || "",
              diStatus: diRow["Status"],
              diName,
              mgName,
              mgId,
              irtId,
            });
          }
        });

        let html = `
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
                  ? matches
                      .map(
                        (m) => `
                    <tr class="table-warning">
                      <td>${m.diId}</td>
                      <td>${m.diName}</td>
                      <td>${m.diStatus}</td>
                      <td>${m.mgName}</td>
                      <td>${m.mgId}</td>
                      <td>${m.irtId}</td>
                    </tr>`
                      )
                      .join("")
                  : `<tr><td colspan="6" class="text-center">No matches found</td></tr>`
              }
            </tbody>
          </table>
        `;
        resultsContainer.innerHTML = html;

        // ✅ Show modal only if matches exist
        if (matches.length > 0) {
          const modal = new bootstrap.Modal(document.getElementById("verifyModal"));
          modal.show();
        }
      },
    });
  } 
});
