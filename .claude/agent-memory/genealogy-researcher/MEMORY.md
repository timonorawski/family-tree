# Genealogy Researcher Agent Memory

## Family Tree MCP Tools
- **Slugs are stable on update**: `update_person` does NOT change slugs. The slug is derived from the filename and only changes via `rename_person`. Do not assume slugs rotate.
- **update_person is a full replace**: It replaces ALL data in the YAML file. You must include the complete relationships array or they get lost. Always `get_person` first, then merge your changes into the full data before calling `update_person`.
- **Use add_relationship/remove_relationship** for relationship changes instead of update_person when possible — they are atomic and won't accidentally drop other fields.

## Irish Line (McGeary Branch)
- **Patriarch**: James McGeary (slug: james-4), b. ~1826 Ireland (Tyrone/Armagh), d. 28 Feb 1891, wagon maker of Bond Head, Ontario
- **Wife**: Sarah Richardson (slug: sarah-5), b. ~1824 Ireland, d. ~1913. Parents: John Richardson (Armagh) + Mary Ann Austin
- **Son**: James Thomas McGeary (slug: james-2), b. 1 Nov 1857, d. 12 Jun 1937, Toronto (37 Sheldrake Blvd)
- **Possible son**: James Edward McGeary (slug: james-1), d. 1904, Grey County -- parentage unconfirmed (45% confidence)
- **Maternal grandparents**: David Austin (slug: david-4, Co. Armagh) + Elizabeth Patterson (slug: elizabeth-1)
- **Thorpe line**: George Thorpe (Mayo/Leitrim, Ireland) -> Robert James Thorpe (slug: robert-8) -> Berta Thorpe -> married into McGeary
- **Margaret Selby** (slug: margaret): death date was 0899, corrected to 1899

## Key Surname Origins
- McGeary: Gaelic "Mac Gadhra" = son of the hound. Ulster origin, Counties Tyrone/Armagh/Donegal
- Richardson: Common across Ulster, this family specifically from County Armagh
- Austin: This family from County Armagh
- Patterson: Common across Ulster, especially Counties Down and Armagh
- Thorpe: This family from Mayo/Leitrim (western Ireland, Connacht -- different from the Ulster families)
- Selby: Early settlers in East Gwillimbury/Sharon, Ontario (Selby Burying Ground est. 1809)
- McKay: Scottish Highland origin (Mac Aoidh)

## Geographic Context
- Bond Head: Townline between Tecumseth and West Gwillimbury, Simcoe County, Ontario
- Southern Simcoe County was 60% Irish by 1881 (highest in Ontario)
- Penville: Settlement in Tecumseth Township where John Richardson is buried

## Data Quality Notes
- Ancestry.ca corrected James McGeary death: Feb 28, 1891 (not Jan 28, 1890)
- Ancestry.ca corrected James Thomas McGeary death: Jun 12, 1937 (not May 12, 1937)
- James McGeary birth year ~1826 (not 1824) based on age 65 at death in 1891
- Ontario marriage records from 1880s have significant gaps

## Open Research Questions
- Parents of James McGeary (patriarch) -- no records found yet
- Parents of John Richardson -- no records found yet
- Parents of David Austin and Elizabeth Patterson -- no records found yet
- Parents of George Thorpe -- no records found yet
- Isabel McKay: no dates, no parents found. Check Ontario marriage records 1826-1943
- Jane "Jennie" Adelaide Rennie: no dates, no parents. Check Grice-Rennie family on Geni.com
- James Edward McGeary (d. 1904 Grey County): is he actually a son of the patriarch? Need full death record
- Other children of James McGeary and Sarah Richardson besides James Thomas?
