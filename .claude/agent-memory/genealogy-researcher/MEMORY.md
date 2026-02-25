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

## Cieluch/Orawski Line (Polish-Hungarian Orava Branch)
- **Jan Cieluch**: father of Eugeniusz. Confirmed from Hungary (Polish citizenship validation). No dates found online.
- **Maria Skiciak**: wife of Jan Cieluch. Surname extremely rare (11 people globally, all Poland per forebears.io).
- **Eugeniusz Cieluch/Orawski**: b. 1910-07-16, d. 1980-04-24. Emigrated to Canada, changed surname to Orawski.
- **Mike Basil Orawski**: d. 2011-12-10 aged 90 (b. ~1921), Leamington ON. Wife: Lucie (d. 2011-11-10). Children: Aline Rocks, Dan Orawski, Dorothy Nawrocki, Bill Orawski. Catholic (St. John de Brebeuf, Kingsville). Possible son or relative of Eugeniusz.
- **Orawski surname in Canada**: 26 bearers per forebears.io. D, H, Matthew, R Orawski listed on Canada411.
- **Cieluch on Geneanet**: 402 entries total. Poland 222, France 46, Germany 38, US 8, Slovakia 6, Hungary 2. Concentrated in Walkow/Borzecice near Kozmin Wielkopolski.
- **Key archival finding**: Arva County records are NOT in Hungarian National Archives (MNL). They are in Slovak State Archives in Bytca (Statny archiv v Bytci). FamilySearch catalogues them under Slovakia, not Hungary.
- **FamilySearch Slovakia collection**: "Slovakia, Church and Synagogue Books, 1592-1935" (1.6M+ images) covers Orava parishes. Search by Slovak OR Hungarian place name.
- **Archives Ontario name change records**: Cover 1939-1986. RG 80 series. Must search County/District Court Matter Indexes. Contact: reference@ontario.ca
- **Orava County DNA Project**: 36 members, 36 surnames. Neither Cieluch nor Skiciak listed. Admin: Karen Melis (zamagurie@zoominternet.net).

## Key Surname Origins (continued)
- Cieluch: Polish, meaning unknown. Suffix -uch. Concentrated in Wielkopolska (Kozmin Wlkp area). ~1,784 globally.
- Skiciak: Extremely rare. Only 11 bearers globally, all in Poland. Possibly Hungarian-influenced? Not found in any Hungarian database.
- Orawski: Polish toponymic = "of Orawa/Orava." 597 globally. Poland 472, Germany 56, Canada 26.

## Duda/Zmora Line (Podwilk, Orawa Branch)
- **Bartlomiej Duda** (slug: bartlomiej): no dates, no death flag. Husband of Jozefina Zmora.
- **Jozefina Zmora** (slug: jozefina): no dates, no death flag. Wife of Bartlomiej.
- **Genevieve Duda/Orawski** (slug: genevieve): b. 1913-03-12 Podwilk, d. 1998-03-09. Married Eugeniusz Cieluch/Orawski.
- **Parish**: Parafia sw. Marcina (St. Martin), Podwilk. Est. 1687. Currently under Archdiocese of Krakow.
- **Critical records issue**: Parish registers reportedly removed in 1945 by Slovak priest Pawel Sopko. Current location unknown (possibly Spis diocesan archive in Spisske Podhradie, Slovakia).
- **Archival jurisdictions**: Pre-1776 Esztergom diocese; 1776-1920 Spis diocese (Slovakia); post-1920 Krakow archdiocese / Polish civil records.
- **FamilySearch**: Zero catalog results for both Podwilk and Jablonka. Podwilk classified as "part of Arva."
- **Geneteka**: Could not retrieve results (JavaScript-dependent). 428 parishes indexed for malopolskie; need manual check if Podwilk included.
- **Matricula-online**: No Podwilk/Spis diocese records found. Only 5 Polish records on entire platform.
- **Hungaricana/Hungarian civil registration**: Arva county not found in FamilySearch inventory for Hungary civil registration. Records from territories ceded to Poland/Slovakia may be in Slovak archives, not Hungarian.
- **Archiwum Narodowe w Krakowie (ANK)**: Has Nowy Targ section (os. Na Skarpie 11/9) covering Jablonka commune. ~190K scans online via szukajwarchiwach.gov.pl. Records from 1810-1911 digitized.
- **Spis Diocesan Archive**: Spiska Kapitula 13, 053 04 Spisske Podhradie, Slovakia. Tel: 053/419 41 33. Email: archivkapitula@gmail.com. Hours: Mon-Fri 8:00-14:45. Book in advance.

## Key Surname Origins (Duda/Zmora)
- Duda: "bagpipe player" (from Wallachian shepherd colonization). 46,616 bearers in Poland, concentrated in southern Poland/Carpathian foothills.
- Zmora: "nightmare demon" in Slavic folklore (creature that suffocates sleepers). 311 bearers in Poland (very rare, 1 in 122,215). 92 in USA, 75 in Brazil.

## Podwilk Historical Context
- Village in Jablonka commune, Nowy Targ County, Malopolskie. Coords: 49.5476N, 19.7387E.
- Etymology: "pod wilk" = "under the wolf" = place of wolves.
- Colonized late 16th c. by settlers from Zywiec/Oswiecim/Zebrzydow regions under Jerzy VII Thurzo.
- 1659 census: 955 Catholics, 13 Lutherans. 1728: 1,690 inhabitants. 1878: 2,147 Catholics + 65 Jews (whole parish).
- Part of Hungarian Orava until 1920 (Treaty of Trianon), then Polish.
- Cholera cemetery with Diveky family burials (1816, 1823). Diveky manor burned 1974.
- GOV gazetteer ID: PODILKJN99UN. SIMC: 0429602.

## Open Research Questions
- Parents of James McGeary (patriarch) -- no records found yet
- Parents of John Richardson -- no records found yet
- Parents of David Austin and Elizabeth Patterson -- no records found yet
- Parents of George Thorpe -- no records found yet
- Isabel McKay: no dates, no parents found. Check Ontario marriage records 1826-1943
- Jane "Jennie" Adelaide Rennie: no dates, no parents. Check Grice-Rennie family on Geni.com
- James Edward McGeary (d. 1904 Grey County): is he actually a son of the patriarch? Need full death record
- Other children of James McGeary and Sarah Richardson besides James Thomas?
- Cieluch in Orava: need to search Bytca archive and FamilySearch Slovakia collection directly
- Skiciak origin: 11 bearers in Poland, none in Hungary. Need direct archive search.
- Eugeniusz Cieluch/Orawski: exact village of birth in Orava? Immigration date to Canada?
- Relationship between Eugeniusz Orawski (d.1980) and Mike Basil Orawski (d.2011)?
- Ontario name change Cieluch->Orawski: search Archives Ontario RG 80 indexes
- Bartlomiej Duda & Jozefina Zmora: no dates. Need Podwilk parish registers.
- Genevieve Duda: birth record (1913) should exist in Hungarian civil registration for Arva county -- check Slovak State Archives in Bytca or ANK Nowy Targ.
- Where did Podwilk parish registers go after 1945? Check Spis diocesan archive directly.
- Canadian immigration record for Genevieve Duda/Orawski: check LAC passenger lists and IRCC post-1935 records.

## Fine Family Line (Toronto Jewish)
- **Research doc:** `/research/fine-family-toronto.md`
- **Irving Fine** (slug: irving): b. 1928-09-17, likely Toronto. Parents UNKNOWN.
- **Shirley Fine** (slug: shirley): b. 1932-11-12, likely Toronto. Maiden name UNKNOWN. Parents UNKNOWN.
- **Children**: David Fine (slug: david-1, b. 1960), Dawna Fine/Satov (slug: dawna, b. 1954), Karyn Fine (slug: karyn, b. 1953)
- **Key finding**: Fine is anglicized from Ashkenazi "Fein" (Yiddish fayn = fine/elegant). Variants: Fein, Fain, Fajn, Feiner, Feinberg, Feinstein.
- **Immigration estimate**: Family likely arrived 1900-1927 from Russian Empire Pale of Settlement (Poland/Lithuania/Belarus/Ukraine) or Austro-Hungary (Galicia). After 1927, Jewish immigration to Canada nearly halted due to restrictive laws.
- **Toronto context**: Jewish population grew from 3,090 (1901) to 45,000 (1931), mostly Polish Jews. Settlement areas: The Ward (1880s-1920s), then Kensington Market (1920s-1930s).

## Key Surname Origins (Fine family)
- Fine/Fein: German/Yiddish "fine, elegant" - common Ashkenazi surname adopted during 1787-1844 surname mandates
- Forebears.io: Fine ranks 20,311th globally, 71% in North America, predominantly Jewish

## Given Name Patterns (Jewish)
- "Irving" was #1 Jewish American male name ~1917 (MIT study) - anglicized from Israel/Isaac/Isaiah
- "Shirley" peaked 1935 (Shirley Temple) - popular Jewish assimilation name; Jews typically kept Hebrew/Yiddish names for religious use
- Ashkenazi naming: children named for recently deceased relatives, never for living ones

## Chusid Family Line (Shirley's Maiden Name)
- **Research doc:** `/research/chusid-family-line.md`
- **Shirley Chusid** (slug: shirley): b. 1932-11-12, Toronto. Married Irving Fine. Maiden name CONFIRMED as Chusid.
- **Etymology**: Hebrew "chasid" (חסיד) = pious one. Yiddish "khusid" = Hasid. Connected to Hasidic movement.
- **Spelling variants**: Chusid, Khusid, Husid, Chusyd, Khuzid, Chasid, Hasid, Hosid, Chosed
- **Geographic origin**: Eastern Europe - Ukraine (Odessa documented ~1900), Poland, Pale of Settlement
- **Global distribution**: ~290 bearers. USA 257 (NY 28%, CA 13%, NJ 10%), Canada 22
- **Odessa connection**: Research indicates Chusid family in Odessa c.1900 with rare mitochondrial haplogroup
- **Hasidic movement**: Founded 1730s-40s in Podolia (western Ukraine) by Baal Shem Tov. By mid-19th c., majority of Ukrainian Jews were Hasidic.
- **Immigration window**: Parents likely arrived 1900-1927 (Great Migration). After 1927 restrictions tightened; 1931 PC 695 halted immigration.

## Key Surname Origins (Chusid)
- Chusid: Hebrew/Yiddish "pious one" - either Hasidic movement follower or person known for piety
- Surname likely adopted under 1804 Russian Empire statute requiring fixed surnames

## Open Research Questions (Chusid family)
- Shirley's parents: Need 1932 Ontario birth certificate, 1931 census for Chusid/Khusid in Toronto
- Specific European origin: Odessa probable but unconfirmed for this branch
- Canadian naturalization records 1915-1939 for Chusid variants
- JewishGen Odessa databases: search for Chusid/Khusid
- Ontario Jewish Archives: Toronto Chusid community records
- Geni.com: 147 Chusid profiles - contact other researchers

## Open Research Questions (Fine family)
- Irving Fine's parents: Need Ontario birth records 1928-1929, 1931 census
- Immigration records: Search LAC passenger lists for Fine/Fein variants 1900-1927
- Synagogue membership: Check Ontario Jewish Archives
- Original surname spelling: Fein? Feinberg? Feinstein? Other compound?
- European origin: Which shtetl in Pale of Settlement?
