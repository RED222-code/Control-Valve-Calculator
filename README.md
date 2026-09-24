# Control Valve Sizing Calculator

A responsive React application for liquid and simplified gas Cv calculations across **Minimum**, **Normal**, and **Maximum** operating conditions.

## Run locally

Use Node.js 22.12 or later (Node.js 24 recommended).

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. Dependencies are already installed in the supplied workspace.

```sh
npm run build     # Create the production site in dist/
npm run preview   # Preview the production build locally
npm test          # Calculation, validation, and Excel parser tests
npm run test:e2e  # Browser, accessibility, and responsive checks
```

The browser suite starts the local server automatically. On Windows it uses Microsoft Edge when installed. On other systems, install the test browser once with `npx playwright install chromium`. To use another installed Chromium browser, set `PLAYWRIGHT_BROWSER_CHANNEL` to its Playwright channel name.

Set `PLAYWRIGHT_PORT` to use a separate local test server when needed (for example, `$env:PLAYWRIGHT_PORT='5183'` in PowerShell). The default is 5173.

The build follows the official [React setup guidance](https://react.dev/learn/build-a-react-app-from-scratch) and [Vite workflow](https://vite.dev/guide/). It produces a static site; no backend or environment variables are required. Deploy the contents of `dist/` at the root of a static host. If deploying to a subdirectory, configure Vite's `base` first.

## Using the calculator

1. Choose **Liquid Service** or **Gas Service**.
2. Enter all required values in each of the three operating columns.
3. Pressure drop updates automatically as valid pressure values are entered.
4. Select **Calculate Cv** to calculate and display all results.
5. Review **Maximum Calculated Cv**, the largest calculated value across the three columns.
6. Select **Download PDF** or **Download Word** to save the completed result section directly. The exported file contains the result details, three Cv values, maximum Cv, and governing condition only.

Each column is evaluated independently. Invalid inputs are identified beside their fields; Calculate focuses the first invalid input. Editing an input clears previously calculated results. Switching modes preserves each mode's in-memory inputs and results. **Reset** clears only the active service. Reloading the page clears both services.

Gas temperature can be entered in °F or K. Changing the temperature unit converts existing numeric temperatures. Temperature is reference information and **does not affect the supplied simplified gas equation**.

## Importing Excel workbooks

Choose **Import Excel**, then **Choose Excel File**. One `.xlsx`, `.xls`, `.xlsm`, or `.xlsb` workbook is held in browser memory at a time. Files are processed locally and are never uploaded, written to a database, or persisted. Refreshing clears the workbook, editable drafts, and results. The Excel parser is loaded only when a file is chosen; [SheetJS Community Edition 0.20.3](https://docs.sheetjs.com/docs/getting-started/installation/frameworks/) is bundled with the static application.

The importer recognizes the supplied **CONTROL VALVE / SERVICE DATA** template family. A selectable valve sheet needs the `CONTROL VALVE` heading, a `SERVICE DATA` section, and the `Fluid State`, `Flow Rate`, and `Upstream Press.` labels in that section. Cover and revision sheets remain visible in the sheet list but are ignored. Select a valve sheet to populate the calculator; nothing is calculated automatically. Service is read from the `Fluid State` value (`Gas`, `Vapor`/`Vapour`, or `Liquid`). If it is unknown, choose Gas or Liquid before importing flow values.

Within `SERVICE DATA`, the parser finds rows by label, so rows may move between template revisions. It then reads **O = Minimum**, **P = Normal**, **Q = Maximum**, and **R = Unit**. For example, the supplied gas sheet contains:

| Label | O: Minimum | P: Normal | Q: Maximum | R: Unit |
| --- | ---: | ---: | ---: | --- |
| Flow Rate | 3.1 | 3.1 | 3.1 | MMSCF/D |
| Upstream Press. | 21.8 | 50.8 | 145 | PSI |
| Downstream Presssure | 20.3 | 21.7 | 74 | PSI |
| Temperature | 26 | 33 | 36 | DEG C |

Small label variations are accepted, including `Gas Flow Rate`, `Inlet Pressure`, `Downstream Pressure`, `Outlet Pressure`, `Expansion Factor`, and `Y Factor`. The template's `Downstream Presssure` typo is also accepted. `Fluid Name` and `Fluid State` use column O without three operating values; design pressure and design temperature have their own single/range layout. Other service rows are read as source data where recognized, but only fields required by the calculator populate its inputs. The datasheet's `Calculated Valve Cv (min/norm/max)` is a reference value, not a calculator input.

The supplied sheet provides flow, pressures, temperature, expansion factor, and density, but no **specific gravity (SG)** or **compressibility factor (Z)** rows. Enter SG and Z manually for each gas operating point before calculating. Density is never silently converted to SG. Missing or ambiguous values and unsupported units stay blank with import notes and inline errors; values are not copied into another operating point. Cached formula values can be read with a warning, while formulas and macros are not executed or recalculated.

Supported conversions for recognized template rows are liquid gpm, m³/hr, bpd, and kbpd to US gpm; gas MMSCFD and SCFH to SCFM; bar/bar(g)/barg and psi/psig to psi on their original pressure basis; and °C/°F/K to the calculator temperature unit. Absolute-pressure spellings are also recognized. Gauge and absolute pressures cannot be mixed; ambiguous pressure references require review. Actual-volume gas flow cannot be treated as SCFM without reference information. Conversion constants follow [NIST SP 811](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8). Review imported units before calculating.

After **Calculate Cv**, the workbook filename (without its extension) heads a compact result stack, with one collapsible card per worksheet. **Download Workbook PDF** or **Download Workbook Word** creates one combined summary for that workbook: the workbook name appears first, followed by each calculated worksheet's Minimum, Normal, Maximum, and governing Cv result in the workbook's original sheet order. Uncalculated worksheets are not included. Selecting a calculated sheet offers **View Existing Result**, **Recalculate**, and **Cancel**. **Load Into Calculator** restores saved inputs for inspection; editing never changes the saved result. Explicit recalculation followed by Calculate replaces that worksheet's result. Other worksheet results stay intact. Switching to **Manual Entry** restores the independent manual service session.

Loading another workbook requires confirmation when saved results exist. A failed replacement preserves the current workbook. Files are limited to 10 MB, 100 worksheets, 10,000 rows and 256 columns per sheet, and 200,000 populated cells overall. The importer targets this template family; unrelated or substantially rearranged datasheets require manual entry or a future parser update.

## Equations and units

```text
Pressure drop: ΔP = P1 − P2
Liquid:        Cv = Q × √(SG / ΔP)
Gas:           Cv = Q × √(SG / (ΔP × Y × Z))
```

| Input | Liquid | Gas |
| --- | --- | --- |
| Q | gpm | SCFM |
| P1, P2, ΔP | psi | psi |
| SG | Dimensionless | Dimensionless |
| Y, Z | Not used | Dimensionless, required |
| T | Not used | °F or K; reference only |

Use the same pressure reference for P1 and P2. All values must be finite numeric inputs; decimal and scientific notation are accepted. Flow must be nonnegative, P1 must exceed P2, and SG/Y/Z must be positive. Required gas temperature must be above absolute zero.

Calculations retain JavaScript double precision internally. Cv display uses 2–3 decimal places, with scientific notation for very small or very large results. Non-representable calculations produce a validation error rather than `NaN`, `Infinity`, or a misleading zero. Intermediate overflow/underflow uses a logarithmic fallback where the final result is representable.

### Method limits

Version 1 implements the equations supplied in the brief. The gas equation is a **simplified sizing method**, not an IEC/ISA-compliant sizing implementation. It does not model temperature or absolute-pressure effects. Final industrial gas valve sizing should be verified using the applicable IEC/ISA control valve sizing standard and manufacturer data.

**Maximum Calculated Cv** is a calculation result, not the selected valve Cv. Final valve selection may require additional engineering margin and manufacturer valve data. Cavitation, flashing, choked flow, noise, valve opening, and manufacturer selection are outside this version.

## Project structure

```text
src/
  calculators/       Reusable liquid/gas equations and numerical safeguards
  components/        Header, service tabs, table, results, formulas, guide
  data/              Operating-column and row definitions, initial state
  hooks/             In-memory workbook/draft/result workflow
  importers/         Workbook reading, sheet detection, field mapping, validation
  pages/             Calculator state and interaction flow
  utils/             Numeric validation, unit detection/conversion, formatting
  App.jsx            Application shell
  main.jsx           React entry point
  styles.css         Responsive design and interaction states
tests/
  calculators.test.js  Node calculation/validation tests
  temperature.test.js  Temperature unit and conversion-boundary tests
  importers.test.js    Excel detection, aliases, units, and ambiguity checks
  calculator.spec.js   Playwright functional, accessibility, and viewport checks
  excel-import.spec.js Browser import, result history, privacy, and dialog checks
```

The equation functions have no React dependency:

```js
import { calculateLiquidCv } from './src/calculators/liquidCalculator.js';
import { calculateGasCv } from './src/calculators/gasCalculator.js';

calculateLiquidCv(100, 1, 100, 75); // { deltaP: 25, cv: 20 }
calculateGasCv(100, 1, 100, 75, 1, 1); // { deltaP: 25, cv: 20 }
```

Both functions expect numeric arguments and throw descriptive errors on invalid input. UI validation returns structured, per-condition field errors before invoking the equations. Additional unit systems and future standards-based methods can be added as separate modules without changing the current equations.

## Accessibility and privacy

Flow and pressure unit selectors convert existing inputs and normalize values to gpm or SCFM and psi before calculation. Pressure selectors share one unit for inlet, outlet, and pressure drop. Gas temperature supports Celsius, Fahrenheit, and kelvin; it remains reference metadata in the simplified gas equation. Unit selections persist with drafts and saved worksheet calculations. Gas flow options use standard-volume units on the same reference basis; actual gas volume is not inferred.

- Semantic table with row/column headers and individually labeled inputs.
- Keyboard-operable service tabs (arrow keys, Home, End), visible focus, skip link, and announced calculation status.
- Inline errors linked to their inputs; no browser alert dialogs.
- Mobile parameter cards show Minimum, Normal, and Maximum together without horizontal scrolling, with 44-48px touch controls. Desktop and tablet retain the comparison table.
- Manual/Excel and Liquid/Gas switches remain sticky while scrolling on both layouts. Validation and worksheet navigation account for the sticky toolbar height.
- Locally bundled fonts; no external font requests, analytics, or application API calls.
- Inputs and normalized parsed worksheet data are saved locally under `controlValveSizingSession` in browser localStorage (version 1). No original Excel files or generated downloads are stored, and no session data is sent to a server.
- Sessions restore automatically after refresh or reopening on the same browser and origin. Saves are debounced by 400 ms and flushed when the page is hidden or closed. Storage errors are reported without interrupting calculations.
- Clear Session removes the saved workspace and resets the calculator after confirmation. Invalid or incompatible saved sessions are discarded safely.

For production hosting, configure transport and security headers in the host (HTTPS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a content security policy allowing the application's own scripts, styles, and fonts). Production does not require third-party runtime resources.
