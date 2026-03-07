let cachedMgIrtData = null;

window.addEventListener("DOMContentLoaded", () => {
  const statusEl = document.getElementById("mgStatus");
  const mgIrtFile = document.getElementById("mgIrtFile");
  const runValidationBtn = document.getElementById("runValidation");

  // ✅ Load MG/IRT data from localStorage on page load
  const stored = localStorage.getItem("mgIrtData");
  if (stored) {
    cachedMgIrtData = JSON.parse(stored);
    statusEl.innerHTML =
      '<i class="bi bi-check-circle-fill me-1 text-success"></i> MG & IRT list loaded from cache';
    statusEl.classList.add("fw-bold", "text-success");
  } else {
    statusEl.innerHTML =
      '<i class="bi bi-x-circle-fill me-1 text-danger"></i> MG & IRT File not found in cache';
    statusEl.classList.add("fw-bold", "text-danger");
  }

  // ✅ Normalize names
  function normalizeName(name) {
    return (name || "")
      .toLowerCase()
      .replace(/\s*&\s*/g, " and ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ✅ Update cache message when user selects a new MG/IRT file
  mgIrtFile.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        complete: (r) => {
          cachedMgIrtData = r.data;
          localStorage.setItem("mgIrtData", JSON.stringify(r.data));
          statusEl.innerHTML =
            '<i class="bi bi-check-circle-fill me-1 text-success"></i> Updated cache';
          statusEl.classList.remove("text-danger");
          statusEl.classList.add("fw-bold", "text-success");
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
    if (cachedMgIrtData) {
      runMgIrtValidation(
        diFile,
        cachedMgIrtData,
        document.getElementById("validationResults")
      );
    } else {
      alert("MG & IRT File not found in cache. Please upload it.");
    }
  });

  function runMgIrtValidation(diFile, mgIrtData, resultsContainer) {
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
                    <tr class="table-success">
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
      },
    });
  }
});
