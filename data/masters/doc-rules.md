# Required documents: starter rules (please review)

GateIQ asks each case for the documents below. The rules live in `src/lib/doc-rules.ts`, and each missing document shows its reason on the case overview. These rules come from general export practice, not a regulation-by-regulation review. Mark anything that is wrong or missing.

| Document | When it is asked for | Reason shown |
|---|---|---|
| Shipping bill | Always | Every export is declared to customs on a shipping bill. |
| Commercial invoice | Always | Customs and the buyer value the goods from the invoice. |
| Packing list | Always | Customs examines and the terminal counts packages against the packing list. |
| E-way bill | Always | Goods moving by road to the port need an e-way bill. |
| Lorry receipt | Always | The transporter's receipt shows which truck carries the goods to the gate. |
| Insurance certificate | Incoterm is CIF or CIP | Under CIF/CIP the seller buys the cargo insurance. |
| Health certificate | Any HS code in chapters 01–05 or 16 (animal products) | Animal products usually need one from the exporting authority. |
| Phytosanitary certificate | Any HS code in chapters 06–14 (plant products) | Plant products usually need one. |
| MSDS | Case marked hazardous | Hazardous cargo travels with its safety data sheet. |
| Temperature spec | Case marked pharma | Pharma cargo needs its temperatures on paper. |
| The certificate picked | Case marked perishable | The case is marked perishable, with this certificate. |

## Questions for review

1. Should the e-way bill be skipped when the consignment is under ₹50,000 or doesn't move by road?
2. Should a certificate of origin be asked for some destinations (for example, those India has trade agreements with)?
3. Are there HS chapters that need an export licence or an agency certificate (for example, spices board or marine products) that should be listed?
4. Should container papers (Form-13, VGM, e-seal) be required once the shipping bill lists containers?
