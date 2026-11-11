PRINCETON REGION INNOVATION RESOURCES: WEB VERSION
==================================================

This folder is the whole website. It needs no Python, no Streamlit, and
nothing installed on the server. The server only has to hand out these
files. Everything else runs in the visitor's web browser.


WHAT'S IN THE FOLDER
--------------------
index.html                           The page itself
styles.css                           Colors and layout
app.js                               Filters, map, tables, export
Princeton-Innovation-Assets_WIP.csv  The directory data (edit this one)
vendor/leaflet/                      The map library (a local copy, so the
                                     page does not depend on outside code)


HOW TO PUT IT ONLINE
--------------------
1. Upload the entire folder, keeping the same structure. The vendor
   folder and the CSV must stay next to index.html.
2. Open index.html at its web address. That's it.

The page uses relative links, so it works in any folder or web address.


HOW TO UPDATE THE DIRECTORY
---------------------------
1. Edit Princeton-Innovation-Assets_WIP.csv in Excel or Google Sheets.
2. Keep the column headings exactly as they are.
3. Save it as CSV with the same filename, and upload it over the old one.
4. Reload the page. No code changes are needed.

To add coordinates for a new entry: in Google Maps, right-click the
building, click the numbers at the top of the menu to copy them, and paste
them into the Latitude and Longitude columns. Distance from Princeton is
calculated automatically.

If you rename the CSV, also change the DATA_FILE line near the top of
app.js to match.


PREVIEWING ON YOUR OWN COMPUTER
-------------------------------
If you double-click index.html, the browser will not let the page read the
CSV automatically (a browser security rule). The page will show a button;
choose the CSV file there and the full page will load.


BACKGROUND MAP (BASEMAP)
------------------------
The background map images ("tiles") come from an outside service. There are
two options, chosen by one line near the top of app.js:

    var CARTO_API_KEY = "";

- Left empty (as delivered): the page uses OpenStreetMap's standard map,
  shown in grayscale. No key or account is needed. OpenStreetMap's tile
  servers are free for modest use like this but come with no guarantee:
  https://operations.osmfoundation.org/policies/tiles/

- With a CARTO key: the page uses CARTO's light gray "Positron" map, the
  look of the original Streamlit app. Keys are free for non-commercial use
  up to 5 million tile requests a month. To set it up:
    1. Request a key at https://carto.com/basemaps/apikey
    2. In the CARTO dashboard, restrict the key to the website's address.
    3. Paste the key between the quotes, for example:
           var CARTO_API_KEY = "abc123yourkey";
    4. Upload the changed app.js.

The key will be visible to anyone who views the page's code. That is normal
for map keys, which is why step 2 matters.

If the host blocks outside connections entirely, the filters, tables,
export, and markers still work, but the map background will be blank.


CREDITS
-------
Map library: Leaflet 1.9.4 (BSD 2-Clause license, see
vendor/leaflet/LICENSE.txt). Map data: OpenStreetMap contributors.
Map images: OpenStreetMap, or CARTO when a CARTO key is set. The page shows
the required credits in the corner of the map automatically.
