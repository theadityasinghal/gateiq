# Reference masters

GateIQ loads its reference lists from official sources. Nothing in the app is a hand-made sample.

| Master | Source | How it's loaded |
|---|---|---|
| UQC units | GSTN list of Unique Quantity Codes (`uqc.csv` in this folder). `tonnes_factor` is set only for mass units. | `npm run masters:import -- uqc` |
| Countries | ISO 3166-1 alpha-2, from the `i18n-iso-countries` package | `npm run masters:import -- iso` |
| Currencies | ISO 4217 active currencies, from the runtime's ICU data (`Intl.supportedValuesOf`) | `npm run masters:import -- iso` |
| Customs locations (ports, ICDs, airports, LCS) | CBIC / ICEGATE customs location code list. Export it as a CSV with columns `code,name,kind,state`. | `npm run masters:import -- ports path/to/locations.csv` |
| ITC-HS codes | DGFT ITC(HS) export schedule. Export it as a CSV with columns `code,description` (8-digit codes). | `npm run masters:import -- hs path/to/itc-hs.csv` |

`npm run masters:import` with no arguments loads UQC, countries and currencies.

Until the port and HS masters are imported, those codes are checked for format only, and the forms say so.
