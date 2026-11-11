/*
 * Princeton Region Innovation Resources
 * Browser-only version of the original Streamlit app (map.py).
 *
 * Everything runs in the visitor's browser. The web server only has to
 * serve these static files: index.html, styles.css, app.js, the vendor/
 * folder, and the CSV data file.
 *
 * To update the directory, edit the CSV and upload it over the old one.
 * No code changes are needed.
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  // Keep this filename the same as the CSV uploaded next to index.html.
  var DATA_FILE = "Princeton-Innovation-Assets_WIP.csv";

  // Fixed map center: Princeton University / Nassau Hall area.
  var PRINCETON_LATITUDE = 40.3487;
  var PRINCETON_LONGITUDE = -74.6593;
  var MAP_RADIUS_MILES = 15;
  var METERS_PER_MILE = 1609.344;

  // ---- Background map ("basemap") -------------------------------------------
  // CARTO's light gray "Positron" basemap now requires a free API key.
  // Get one at https://carto.com/basemaps/apikey and paste it between the
  // quotes below. While this is left empty, the page uses OpenStreetMap's
  // standard map instead, shown in grayscale, which needs no key.
  var CARTO_API_KEY = "";

  var OSM_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  // Map tile servers need to know which website is asking (the "Referer").
  // OpenStreetMap blocks requests without it, so it is set explicitly here
  // in case the web server or page settings would otherwise remove it.
  var TILE_REFERRER_POLICY = "strict-origin-when-cross-origin";

  var BASEMAPS = {
    carto: {
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key={key}",
      options: {
        attribution: OSM_ATTRIBUTION + ' &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
        referrerPolicy: TILE_REFERRER_POLICY
      },
      tileCredit: { text: "Map images © CARTO", href: "https://carto.com/attributions" }
    },
    openstreetmap: {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      options: {
        attribution: OSM_ATTRIBUTION,
        maxZoom: 19,
        className: "basemap-grayscale",
        referrerPolicy: TILE_REFERRER_POLICY
      },
      tileCredit: {
        text: "Map images courtesy of the OpenStreetMap Foundation",
        href: "https://operations.osmfoundation.org/policies/tiles/"
      }
    }
  };

  var DEFAULT_MARKER_COLOR = [100, 100, 100];
  var PRINCETON_ORANGE = "#EE7F2D";

  var CATEGORY_COLORS = {
    "Coworking": [0, 119, 139],
    "Wet/Dry Lab": [91, 135, 74],
    "Prototyping": [126, 84, 164],
    "Prototyping (Accelerator-members Only)": [214, 51, 132],
    "Coworking (Accelerator-members Only)": [190, 30, 45],
    "Research Core Facility": [238, 127, 45],
    "Innovation Center / Research Park": [255, 215, 0],
    "Incubator / Accelerator": [128, 85, 44]
  };

  var REQUIRED_COLUMNS = [
    "Category", "Organization Name", "Address", "Status", "Space Type",
    "Published Price", "Princeton Affiliation?", "More Info / Website",
    "CSIT Vouchers Accepted?",
    "Accelerator / Incubator Program & NJEDA Recognition",
    "Latitude", "Longitude", "Last Verified"
  ];

  // Long text fields keep their line breaks on the detail tab.
  var MULTILINE_COLUMNS = [
    "Space Type", "Published Price", "Princeton Affiliation?",
    "Accelerator / Incubator Program & NJEDA Recognition"
  ];

  // Optional legacy column, only used for rows that have no coordinates.
  var LEGACY_DISTANCE_COLUMN = "Distance from Princeton U (mi)";

  var NJEDA_COLUMN = "Accelerator / Incubator Program & NJEDA Recognition";

  var HELP = {
    "help-affiliation":
      "'Yes' means a direct Princeton University connection, such as a " +
      "Princeton facility, a founding partnership, or a stated preference for " +
      "the Princeton community.",
    "help-njeda":
      "NJEDA is the New Jersey Economic Development Authority. 'Yes' means the " +
      "resource is an approved NJ Ignite workspace or an NJEDA Strategic " +
      "Innovation Center (SIC). Listings that only appear in NJEDA directories " +
      "without approval are not counted.",
    "help-search": "Simple keyword search.",
    "help-csit":
      "CSIT is the New Jersey Commission on Science, Innovation and Technology. " +
      "Its Innovation Vouchers help eligible companies pay for work at " +
      "approved facilities. Voucher acceptance is unconfirmed for most " +
      "listings, so this filter returns only resources confirmed as accepting."
  };

  var SEARCHABLE_COLUMNS = [
    "Category", "Organization Name", "Address", "Status", "Space Type",
    "Published Price", "Princeton Affiliation?", "CSIT Vouchers Accepted?",
    NJEDA_COLUMN
  ];

  var DIRECTORY_COLUMNS = [
    { key: "Category", label: "Category" },
    { key: "Organization Name", label: "Organization Name", name: true },
    { key: "Status", label: "Status" },
    { key: "Address", label: "Address" },
    { key: "Distance (mi)", label: "Distance from Princeton", distance: true },
    { key: "Space Type", label: "Space Type", clamp: true },
    { key: "Published Price", label: "Published Price", clamp: true },
    { key: "Affiliation Status", label: "Princeton University affiliation" },
    { key: "CSIT Vouchers Accepted?", label: "CSIT vouchers" },
    { key: "Program Status", label: "NJEDA recognized" },
    { key: "Website URL", label: "Website", link: true }
  ];

  var EXPORT_COLUMNS = [
    "Category", "Organization Name", "Status", "Address", "Latitude",
    "Longitude", "Distance (mi)", "Space Type", "Published Price",
    "Princeton Affiliation?", "Affiliation Status", "More Info / Website",
    "Website URL", "CSIT Vouchers Accepted?", NJEDA_COLUMN, "Program Status",
    "Last Verified"
  ];

  var EXPORT_FILE_NAME = "princeton_innovation_resources_filtered.csv";

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------

  function $(id) { return document.getElementById(id); }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === "text") node.textContent = value;
        else if (key === "className") node.className = value;
        else if (key === "onClick") node.addEventListener("click", value);
        else node.setAttribute(key, value === true ? "" : value);
      });
    }
    (children || []).forEach(function (child) {
      if (child === null || child === undefined) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  /** Collapse all whitespace to single spaces (same as the Python clean_text). */
  function cleanText(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/ /g, " ").split(/\s+/).filter(Boolean).join(" ");
  }

  /** Clean text but keep line breaks, dropping repeated blank lines. */
  function cleanMultiline(value) {
    if (value === null || value === undefined) return "";
    var lines = String(value).replace(/ /g, " ").replace(/\r\n?/g, "\n").split("\n")
      .map(function (line) { return cleanText(line); });
    var out = [];
    lines.forEach(function (line) {
      if (line === "" && (out.length === 0 || out[out.length - 1] === "")) return;
      out.push(line);
    });
    while (out.length && out[out.length - 1] === "") out.pop();
    return out.join("\n");
  }

  function toNumber(value) {
    var text = cleanText(value);
    if (!text) return NaN;
    var number = Number(text);
    return isFinite(number) ? number : NaN;
  }

  function hasNumber(value) { return typeof value === "number" && !isNaN(value); }

  function extractFirstUrl(value) {
    var match = cleanText(value).match(/(https?:\/\/[^\s,;]+|www\.[^\s,;]+)/i);
    if (!match) return "";
    var url = match[1].replace(/[.,);\]}>]+$/, "");
    if (/^www\./i.test(url)) url = "https://" + url;
    return url;
  }

  /** Only allow http(s) links into the page. */
  function safeUrl(url) {
    try {
      var parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "";
    } catch (e) {
      return "";
    }
  }

  function extractDistance(value) {
    var match = cleanText(value).match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  }

  function classifyAffiliation(note) {
    return cleanText(note).toLowerCase().indexOf("yes") === 0 ? "Yes" : "Not specified";
  }

  /** "NJ Ignite" and "SIC" count as Yes; "Partial", "None", blanks, etc. do not. */
  function classifyProgramStatus(note) {
    var lower = cleanText(note).toLowerCase();
    return lower.indexOf("nj ignite") === 0 || lower.indexOf("sic") === 0 ? "Yes" : "Not specified";
  }

  /** Straight-line (great-circle) distance in miles from Princeton, 1 decimal. */
  function distanceFromPrinceton(latitude, longitude) {
    if (!hasNumber(latitude) || !hasNumber(longitude)) return NaN;
    var earthRadiusMiles = 3958.7613;
    var toRad = Math.PI / 180;
    var lat1 = PRINCETON_LATITUDE * toRad;
    var lat2 = latitude * toRad;
    var dLat = lat2 - lat1;
    var dLon = (longitude - PRINCETON_LONGITUDE) * toRad;
    var a = Math.pow(Math.sin(dLat / 2), 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dLon / 2), 2);
    var miles = 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
    return Math.round(miles * 10) / 10;
  }

  function formatDistance(value) {
    return hasNumber(value) ? value.toFixed(1) + " miles" : "Not listed";
  }

  function categoryColor(category) {
    return CATEGORY_COLORS[cleanText(category)] || DEFAULT_MARKER_COLOR;
  }

  function rgb(color) { return "rgb(" + color[0] + ", " + color[1] + ", " + color[2] + ")"; }

  function googleMapsUrl(address) {
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(cleanText(address));
  }

  /** Most common value; ties go to the alphabetically first (like pandas mode()). */
  function mode(values) {
    var counts = {};
    values.forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    var best = null;
    Object.keys(counts).forEach(function (v) {
      if (best === null || counts[v] > counts[best] || (counts[v] === counts[best] && v < best)) best = v;
    });
    return best;
  }

  function compareText(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

  /** Sort by distance (missing last), then by organization name. */
  function byDistanceThenName(a, b) {
    var da = a["Distance (mi)"], db = b["Distance (mi)"];
    var aHas = hasNumber(da), bHas = hasNumber(db);
    if (aHas && bHas && da !== db) return da - db;
    if (aHas !== bHas) return aHas ? -1 : 1;
    return compareText(a["Organization Name"], b["Organization Name"]);
  }

  // ---------------------------------------------------------------------------
  // CSV reading and writing
  // ---------------------------------------------------------------------------

  /** Parse CSV text (handles quoted fields, commas and line breaks inside quotes). */
  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    var i = 0;
    var length = text.length;

    while (i < length) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i += 1; continue;
        }
        field += ch; i += 1; continue;
      }
      if (ch === '"') { inQuotes = true; i += 1; continue; }
      if (ch === ",") { row.push(field); field = ""; i += 1; continue; }
      if (ch === "\r" || ch === "\n") {
        row.push(field); field = "";
        rows.push(row); row = [];
        if (ch === "\r" && text[i + 1] === "\n") i += 1;
        i += 1; continue;
      }
      field += ch; i += 1;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  /** Decode as UTF-8; fall back to Windows-1252 for files saved by older Excel. */
  function decodeBytes(buffer) {
    var text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch (e) {
      text = new TextDecoder("windows-1252").decode(buffer);
    }
    return text.replace(/^﻿/, "");
  }

  function csvField(value) {
    var text = value === null || value === undefined ? "" : String(value);
    if (typeof value === "number" && isNaN(value)) text = "";
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function toCsv(records, columns) {
    var lines = [columns.map(csvField).join(",")];
    records.forEach(function (record) {
      lines.push(columns.map(function (column) { return csvField(record[column]); }).join(","));
    });
    return lines.join("\r\n") + "\r\n";
  }

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  function buildAssets(text) {
    var rows = parseCsv(text).filter(function (r) {
      return r.some(function (cell) { return cleanText(cell) !== ""; });
    });
    if (!rows.length) throw new Error("The CSV file is empty.");

    var headers = rows[0].map(cleanText);
    var assets = [];

    rows.slice(1).forEach(function (cells) {
      var raw = {};
      headers.forEach(function (header, index) { raw[header] = cells[index] === undefined ? "" : cells[index]; });

      var record = {};
      headers.concat(REQUIRED_COLUMNS).forEach(function (column) {
        if (column in record) return;
        record[column] = cleanText(raw[column]);
      });

      var name = record["Organization Name"];
      if (!name || name.toLowerCase().indexOf("organization name") !== -1) return;

      record.multiline = {};
      MULTILINE_COLUMNS.forEach(function (column) { record.multiline[column] = cleanMultiline(raw[column]); });

      record.Latitude = toNumber(record.Latitude);
      record.Longitude = toNumber(record.Longitude);
      var distance = distanceFromPrinceton(record.Latitude, record.Longitude);
      if (!hasNumber(distance) && LEGACY_DISTANCE_COLUMN in record) {
        distance = extractDistance(record[LEGACY_DISTANCE_COLUMN]);
      }
      record["Distance (mi)"] = distance;

      if (!record.Status) record.Status = "Open";
      record["Website URL"] = safeUrl(extractFirstUrl(record["More Info / Website"]));
      record["Affiliation Status"] = classifyAffiliation(record["Princeton Affiliation?"]);
      record["Program Status"] = classifyProgramStatus(record[NJEDA_COLUMN]);
      record.searchText = SEARCHABLE_COLUMNS.map(function (c) { return record[c]; }).join(" ").toLowerCase();

      assets.push(record);
    });

    assets.sort(byDistanceThenName);
    assets.forEach(function (asset, index) { asset.id = index; });
    return assets;
  }

  // ---------------------------------------------------------------------------
  // App state
  // ---------------------------------------------------------------------------

  var assets = [];
  var filtered = [];
  var categories = [];
  var maxDistance = 15;
  var selectedDetailId = null;
  var directorySort = { key: null, direction: "ascending" };

  var map = null;
  var markerLayer = null;
  var ringBounds = null;
  var mapFitted = false;

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------

  function setupFilters() {
    var list = $("category-list");
    list.textContent = "";
    categories.forEach(function (category) {
      var input = el("input", { type: "checkbox", value: category, checked: true });
      input.addEventListener("change", update);
      list.appendChild(el("label", { className: "check" }, [
        input,
        el("span", { className: "swatch", style: "background:" + rgb(categoryColor(category)), "aria-hidden": "true" }),
        el("span", { text: category })
      ]));
    });

    $("cat-all").addEventListener("click", function () { setAllCategories(true); });
    $("cat-none").addEventListener("click", function () { setAllCategories(false); });

    var slider = $("distance");
    slider.max = String(maxDistance);
    slider.value = String(maxDistance);
    slider.addEventListener("input", update);

    ["affiliation", "program", "csit", "planned"].forEach(function (id) {
      $(id).addEventListener("change", update);
    });
    $("search").addEventListener("input", update);

    $("reset").addEventListener("click", function () {
      setAllCategories(true, true);
      slider.value = String(maxDistance);
      $("affiliation").value = "All";
      $("program").value = "All";
      $("search").value = "";
      $("csit").checked = false;
      $("planned").checked = true;
      update();
    });

    Array.prototype.forEach.call(document.querySelectorAll(".help-button"), function (button) {
      var panel = $(button.getAttribute("aria-controls"));
      panel.textContent = HELP[panel.id] || "";
      button.addEventListener("click", function () {
        var open = button.getAttribute("aria-expanded") === "true";
        button.setAttribute("aria-expanded", String(!open));
        panel.hidden = open;
      });
    });

    var toggle = $("filters-toggle");
    toggle.addEventListener("click", function () {
      var body = $("filters-body");
      var collapsed = body.classList.toggle("collapsed");
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.textContent = collapsed ? "Show filters" : "Hide filters";
    });
    if (window.matchMedia("(max-width: 900px)").matches) toggle.click();
  }

  function setAllCategories(checked, silent) {
    Array.prototype.forEach.call(document.querySelectorAll("#category-list input"), function (input) {
      input.checked = checked;
    });
    if (!silent) update();
  }

  function readFilters() {
    var selected = Array.prototype.filter.call(
      document.querySelectorAll("#category-list input"), function (i) { return i.checked; }
    ).map(function (i) { return i.value; });
    return {
      categories: selected,
      distance: Number($("distance").value),
      affiliation: $("affiliation").value,
      program: $("program").value,
      words: $("search").value.toLowerCase().split(/\s+/).filter(Boolean),
      csit: $("csit").checked,
      planned: $("planned").checked
    };
  }

  function applyFilters(f) {
    return assets.filter(function (a) {
      if (f.categories.indexOf(a.Category) === -1) return false;
      if (f.csit && a["CSIT Vouchers Accepted?"].trim().toLowerCase().indexOf("yes") !== 0) return false;
      if (!f.planned && a.Status === "Planned") return false;
      // Resources without a single location have no distance and are always kept.
      if (hasNumber(a["Distance (mi)"]) && a["Distance (mi)"] > f.distance) return false;
      if (f.affiliation !== "All" && a["Affiliation Status"] !== f.affiliation) return false;
      if (f.program !== "All" && a["Program Status"] !== f.program) return false;
      for (var i = 0; i < f.words.length; i++) {
        if (a.searchText.indexOf(f.words[i]) === -1) return false;
      }
      return true;
    });
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function update() {
    var f = readFilters();
    $("distance-value").textContent = f.distance.toFixed(1) + " miles";
    filtered = applyFilters(f).sort(byDistanceThenName);

    $("m-matching").textContent = filtered.length;
    $("m-mapped").textContent = filtered.filter(isMapped).length;
    $("m-five").textContent = filtered.filter(function (a) { return a["Distance (mi)"] <= 5; }).length;
    $("m-core").textContent = filtered.filter(function (a) { return a.Category === "Research Core Facility"; }).length;

    renderLegend();
    renderMarkers();
    renderUnmapped();
    renderDirectory();
    renderDetail();
    renderExportPreview();
  }

  function isMapped(a) { return hasNumber(a.Latitude) && hasNumber(a.Longitude); }

  function renderLegend() {
    var present = {};
    filtered.forEach(function (a) { if (a.Category) present[a.Category] = true; });
    var items = Object.keys(CATEGORY_COLORS).filter(function (c) { return present[c]; })
      .map(function (c) { return [c, CATEGORY_COLORS[c]]; });
    Object.keys(present).filter(function (c) { return !(c in CATEGORY_COLORS); }).sort()
      .forEach(function (c) { items.push([c, DEFAULT_MARKER_COLOR]); });

    var legend = $("legend");
    legend.textContent = "";
    items.forEach(function (item) {
      legend.appendChild(el("span", { className: "legend-item" }, [
        el("span", { className: "swatch", style: "background:" + rgb(item[1]), "aria-hidden": "true" }),
        el("span", { text: item[0] })
      ]));
    });
    var note = legend.nextElementSibling;
    if (!note || !note.classList.contains("legend-note")) {
      note = el("p", { className: "legend-note" });
      legend.parentNode.insertBefore(note, legend.nextSibling);
    }
    note.textContent = items.length
      ? "Faded markers are planned facilities that are not yet open. Larger markers group several resources in the same building."
      : "";
  }

  // ----- Credits -----

  /** Fill the page footer with the credits required for the map in use. */
  function renderFooterCredits(basemap) {
    var list = $("credits");
    list.textContent = "";
    function credit(parts) {
      var item = el("li");
      parts.forEach(function (part) {
        item.appendChild(typeof part === "string" ? document.createTextNode(part)
          : el("a", { href: part.href, target: "_blank", rel: "noopener noreferrer", text: part.text }));
      });
      list.appendChild(item);
    }
    credit(["Map data © ", { text: "OpenStreetMap contributors", href: "https://www.openstreetmap.org/copyright" },
      ", available under the Open Database License."]);
    credit([{ text: basemap.tileCredit.text, href: basemap.tileCredit.href }, "."]);
    credit(["Map display: ", { text: "Leaflet", href: "https://leafletjs.com" }, " (BSD 2-Clause License)."]);
  }

  // ----- Map -----

  function setupMap() {
    var center = [PRINCETON_LATITUDE, PRINCETON_LONGITUDE];
    map = L.map("map", { zoomSnap: 0.25, scrollWheelZoom: true }).setView(center, 10);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
    var key = String(CARTO_API_KEY || "").trim();
    var basemap = key ? BASEMAPS.carto : BASEMAPS.openstreetmap;
    var tileOptions = L.extend({}, basemap.options, key ? { key: encodeURIComponent(key) } : {});
    L.tileLayer(basemap.url, tileOptions).addTo(map);
    $("map").setAttribute("data-basemap", key ? "carto" : "openstreetmap");
    renderFooterCredits(basemap);

    if (window.location.protocol === "file:") {
      $("map-local-note").hidden = false;
    }

    L.circle(center, {
      radius: MAP_RADIUS_MILES * METERS_PER_MILE,
      color: PRINCETON_ORANGE, weight: 2, fill: false, interactive: false
    }).addTo(map);

    L.circleMarker(center, {
      radius: 8, color: "#ffffff", weight: 2, fillColor: "#1D1D1B", fillOpacity: 1, interactive: false
    }).addTo(map);

    // Bounds of the ring, computed directly so they don't depend on map state.
    ringBounds = L.latLng(center).toBounds(2 * MAP_RADIUS_MILES * METERS_PER_MILE);
    markerLayer = L.layerGroup().addTo(map);
    map.on("zoomend", drawMarkers);
    fitMap();
  }

  function fitMap() {
    // Fit the 15-mile ring, so the view adapts to any screen size.
    map.invalidateSize();
    map.fitBounds(ringBounds, { padding: [20, 20] });
    mapFitted = true;
  }

  function buildMarkerGroups(mapped) {
    var groups = [];
    var byKey = {};
    mapped.forEach(function (a) {
      // Coordinates rounded to 4 decimal places (about 10 meters).
      var key = a.Latitude.toFixed(4) + "," + a.Longitude.toFixed(4);
      if (!byKey[key]) { byKey[key] = []; groups.push(byKey[key]); }
      byKey[key].push(a);
    });
    return groups;
  }

  function summaryLines(a) {
    return [
      "Category: " + a.Category,
      "Status: " + (a.Status === "Planned" ? "Planned (not yet open)" : a.Status),
      "Address: " + a.Address,
      "Distance: " + formatDistance(a["Distance (mi)"]),
      "CSIT vouchers: " + (a["CSIT Vouchers Accepted?"] || "Unknown"),
      "NJEDA recognized: " + a["Program Status"]
    ];
  }

  function tooltipContent(group) {
    var box = el("div", { className: "marker-tooltip" });
    if (group.length === 1) {
      box.appendChild(el("div", { className: "tt-title", text: group[0]["Organization Name"] }));
      summaryLines(group[0]).forEach(function (line) { box.appendChild(el("div", { text: line })); });
    } else {
      box.appendChild(el("div", { className: "tt-title", text: group.length + " resources at this location" }));
      box.appendChild(el("div", { text: "Address: " + groupAddress(group) }));
      box.appendChild(el("div", { text: "Distance: " + formatDistance(group[0]["Distance (mi)"]) }));
      var list = el("ul");
      group.forEach(function (a) { list.appendChild(el("li", { text: a["Organization Name"] })); });
      box.appendChild(list);
    }
    return box;
  }

  function popupContent(group) {
    var box = el("div", { className: "popup-body" });
    if (group.length === 1) {
      var a = group[0];
      box.appendChild(el("div", { className: "popup-title", text: a["Organization Name"] }));
      box.appendChild(el("div", { text: a.Category + (a.Status === "Planned" ? " (planned, not yet open)" : "") }));
      box.appendChild(el("div", { text: a.Address }));
      var actions = el("div", { className: "popup-actions" });
      actions.appendChild(el("button", { type: "button", text: "View details", onClick: function () { openDetail(a.id); } }));
      if (a["Website URL"]) {
        actions.appendChild(el("a", { href: a["Website URL"], target: "_blank", rel: "noopener noreferrer", text: "Website" }));
      }
      if (a.Address) {
        actions.appendChild(el("a", { href: googleMapsUrl(a.Address), target: "_blank", rel: "noopener noreferrer", text: "Google Maps" }));
      }
      box.appendChild(actions);
    } else {
      box.appendChild(el("div", { className: "popup-title", text: group.length + " resources at this location" }));
      box.appendChild(el("div", { text: mode(group.map(function (x) { return x.Address; })) }));
      var list = el("ul", { className: "popup-list" });
      group.forEach(function (x) {
        list.appendChild(el("li", {}, [
          el("button", { type: "button", text: x["Organization Name"], onClick: function () { openDetail(x.id); } })
        ]));
      });
      box.appendChild(list);
    }
    return box;
  }

  // Building groups for the current filters; redrawn as clusters on each zoom.
  var buildingGroups = [];

  function renderMarkers() {
    if (!map) return;
    var mapped = filtered.filter(isMapped);
    $("map-empty").hidden = mapped.length > 0;
    buildingGroups = buildMarkerGroups(mapped);
    $("map").setAttribute("data-locations", String(buildingGroups.length));
    drawMarkers();
  }

  function markerRadius(count) { return Math.min(8 + 2 * (count - 1), 18); }

  function averagePosition(resources) {
    var lat = 0, lon = 0;
    resources.forEach(function (a) { lat += a.Latitude; lon += a.Longitude; });
    return L.latLng(lat / resources.length, lon / resources.length);
  }

  /**
   * Merge locations whose markers would overlap at the current zoom level,
   * so no marker is hidden underneath another. Zooming in separates them.
   */
  function clusterGroups() {
    var clusters = [];
    buildingGroups
      .map(function (group, order) {
        return { group: group, order: order, point: map.latLngToLayerPoint(averagePosition(group)) };
      })
      .sort(function (a, b) { return b.group.length - a.group.length || a.order - b.order; })
      .forEach(function (item) {
        var radius = markerRadius(item.group.length);
        var target = null;
        for (var i = 0; i < clusters.length; i++) {
          var c = clusters[i];
          // Overlap test: centers closer than the larger marker's radius plus a margin.
          if (c.point.distanceTo(item.point) < Math.max(radius, c.radius) + 4) { target = c; break; }
        }
        if (target) {
          target.groups.push(item.group);
          target.order = Math.min(target.order, item.order);
        } else {
          clusters.push({ groups: [item.group], point: item.point, radius: radius, order: item.order });
        }
      });
    return clusters.sort(function (a, b) { return a.order - b.order; });
  }

  function drawMarkers() {
    if (!map) return;
    markerLayer.clearLayers();
    clusterGroups().forEach(function (cluster) {
      var resources = [].concat.apply([], cluster.groups);
      var allPlanned = resources.every(function (a) { return a.Status === "Planned"; });
      var color = rgb(categoryColor(mode(resources.map(function (a) { return a.Category; }))));
      var single = cluster.groups.length === 1;

      var marker = L.circleMarker(averagePosition(resources), {
        radius: markerRadius(resources.length),
        color: "#ffffff", weight: 1.5,
        fillColor: color, fillOpacity: allPlanned ? 0.5 : 1, opacity: allPlanned ? 0.7 : 1
      });
      marker.bindTooltip(single ? tooltipContent(cluster.groups[0]) : clusterTooltip(cluster.groups),
        { sticky: true, direction: "top", offset: [0, -6], opacity: 1 });
      marker.bindPopup(single ? popupContent(cluster.groups[0]) : clusterPopup(cluster.groups), {
        maxWidth: 320, maxHeight: 320, autoPanPadding: [20, 20]
      });
      marker.on("popupopen", function () { marker.closeTooltip(); });
      marker.addTo(markerLayer);
    });
  }

  function groupAddress(group) { return mode(group.map(function (a) { return a.Address; })); }

  function clusterTooltip(groups) {
    var total = groups.reduce(function (s, g) { return s + g.length; }, 0);
    var box = el("div", { className: "marker-tooltip" });
    box.appendChild(el("div", { className: "tt-title", text: total + " resources nearby" }));
    // Keep the hover summary short; the click popup lists every name.
    var list = el("ul");
    groups.forEach(function (group) {
      var place = group.length === 1 ? group[0]["Organization Name"] : groupAddress(group).split(",")[0];
      list.appendChild(el("li", { text: place + (group.length > 1 ? " (" + group.length + ")" : "") }));
    });
    box.appendChild(list);
    box.appendChild(el("div", { className: "tt-hint", text: "Click for the full list, or zoom in to separate them." }));
    return box;
  }

  function clusterPopup(groups) {
    var total = groups.reduce(function (s, g) { return s + g.length; }, 0);
    var box = el("div", { className: "popup-body" });
    box.appendChild(el("div", { className: "popup-title", text: total + " resources nearby" }));
    groups.forEach(function (group) {
      box.appendChild(el("div", { className: "tt-address", text: groupAddress(group) }));
      var list = el("ul", { className: "popup-list" });
      group.forEach(function (a) {
        list.appendChild(el("li", {}, [
          el("button", { type: "button", text: a["Organization Name"], onClick: function () { openDetail(a.id); } })
        ]));
      });
      box.appendChild(list);
    });
    var position = averagePosition([].concat.apply([], groups));
    box.appendChild(el("div", { className: "popup-actions" }, [
      el("button", { type: "button", text: "Zoom in here", onClick: function () {
        map.closePopup();
        map.setView(position, Math.min(map.getZoom() + 2, 18));
      } })
    ]));
    return box;
  }

  function renderUnmapped() {
    var unmapped = filtered.filter(function (a) { return !isMapped(a); });
    var details = $("unmapped");
    details.hidden = unmapped.length === 0;
    $("unmapped-summary").textContent = unmapped.length + " resource(s) not shown on the map";
    fillTable($("unmapped-table"), [
      { key: "Organization Name", label: "Organization Name" },
      { key: "Address", label: "Address" },
      { key: "Category", label: "Category" }
    ], unmapped);
  }

  // ----- Tables -----

  function cellContent(column, record) {
    var value = record[column.key];
    if (column.distance) return hasNumber(value) ? value.toFixed(1) + " mi" : "";
    if (column.link) {
      return value ? el("a", { href: value, target: "_blank", rel: "noopener noreferrer", text: "Open" }) : "";
    }
    if (column.name) {
      return el("button", { type: "button", className: "name-button", text: value, onClick: function () { openDetail(record.id); } });
    }
    if (column.clamp) return el("div", { className: "clamp", title: value, text: value });
    if (typeof value === "number") return isNaN(value) ? "" : String(value);
    return value || "";
  }

  function fillTable(table, columns, records, sortState, onSort) {
    table.textContent = "";
    var headRow = el("tr");
    columns.forEach(function (column) {
      var th = el("th", { scope: "col" });
      if (onSort) {
        if (sortState.key === column.key) th.setAttribute("aria-sort", sortState.direction);
        th.appendChild(el("button", { type: "button", text: column.label, onClick: function () { onSort(column.key); } }));
      } else {
        th.textContent = column.label;
      }
      headRow.appendChild(th);
    });
    table.appendChild(el("thead", {}, [headRow]));

    var body = el("tbody");
    records.forEach(function (record) {
      var row = el("tr");
      columns.forEach(function (column) {
        var content = cellContent(column, record);
        row.appendChild(el("td", { className: column.distance ? "num" : null }, [content]));
      });
      body.appendChild(row);
    });
    table.appendChild(body);
  }

  function sortedForDirectory() {
    var key = directorySort.key;
    if (!key) return filtered.slice();
    var sign = directorySort.direction === "ascending" ? 1 : -1;
    return filtered.slice().sort(function (a, b) {
      var va = a[key], vb = b[key];
      var aMissing = va === "" || (typeof va === "number" && isNaN(va));
      var bMissing = vb === "" || (typeof vb === "number" && isNaN(vb));
      if (aMissing !== bMissing) return aMissing ? 1 : -1; // blanks always last
      if (typeof va === "number" && typeof vb === "number") return sign * (va - vb);
      return sign * String(va).localeCompare(String(vb), undefined, { sensitivity: "base" });
    });
  }

  function renderDirectory() {
    fillTable($("directory-table"), DIRECTORY_COLUMNS, sortedForDirectory(), directorySort, function (key) {
      if (directorySort.key === key) {
        directorySort.direction = directorySort.direction === "ascending" ? "descending" : "ascending";
      } else {
        directorySort = { key: key, direction: "ascending" };
      }
      renderDirectory();
    });
  }

  function renderExportPreview() {
    fillTable($("export-table"), EXPORT_COLUMNS.map(function (c) { return { key: c, label: c }; }), filtered);
  }

  // ----- Detail -----

  function renderDetail() {
    var empty = filtered.length === 0;
    $("detail-empty").hidden = !empty;
    $("detail-body").hidden = empty;
    if (empty) return;

    var ids = filtered.map(function (a) { return a.id; });
    if (selectedDetailId === null || ids.indexOf(selectedDetailId) === -1) selectedDetailId = ids[0];

    var select = $("detail-select");
    select.textContent = "";
    filtered.forEach(function (a) {
      select.appendChild(el("option", { value: String(a.id), text: a["Organization Name"] }));
    });
    select.value = String(selectedDetailId);

    var asset = assets[selectedDetailId];
    var left = $("detail-left");
    var right = $("detail-right");
    left.textContent = "";
    right.textContent = "";

    left.appendChild(el("h2", { text: asset["Organization Name"] }));
    left.appendChild(labeled("Category", asset.Category));
    if (asset.Status === "Planned") left.appendChild(el("p", { className: "warning", text: "Planned facility: not yet open." }));
    left.appendChild(labeled("Address", asset.Address));
    left.appendChild(labeled("Distance from Princeton University",
      hasNumber(asset["Distance (mi)"]) ? asset["Distance (mi)"].toFixed(1) + " miles (straight line)" : "No single location"));
    left.appendChild(el("p", { className: "verified", text: "Last verified: " + (asset["Last Verified"] || "Not yet recorded") }));
    if (asset["Website URL"]) {
      left.appendChild(el("a", { className: "action-button", href: asset["Website URL"], target: "_blank", rel: "noopener noreferrer", text: "Open website" }));
    }
    if (asset.Address) {
      left.appendChild(el("a", { className: "action-button", href: googleMapsUrl(asset.Address), target: "_blank", rel: "noopener noreferrer", text: "Open in Google Maps" }));
    }

    right.appendChild(el("h3", { text: "Space and pricing" }));
    right.appendChild(el("p", { className: "preserve-lines", text: asset.multiline["Space Type"] || "Not listed" }));
    right.appendChild(el("p", { className: "preserve-lines" }, [
      el("strong", { text: "Published price (subject to change): " }),
      asset.multiline["Published Price"] || "Not listed"
    ]));
    right.appendChild(el("h3", { text: "Princeton University affiliation or discounts" }));
    right.appendChild(el("p", { className: "preserve-lines", text: asset.multiline["Princeton Affiliation?"] || "Needs review" }));
    right.appendChild(el("h3", { text: "CSIT vouchers" }));
    right.appendChild(el("p", { text: asset["CSIT Vouchers Accepted?"] || "Unknown — confirm directly" }));
    right.appendChild(el("h3", { text: "NJEDA recognized" }));
    right.appendChild(el("p", { className: "preserve-lines", text: asset.multiline[NJEDA_COLUMN] || "No notes listed" }));
  }

  function labeled(label, value) {
    return el("p", {}, [el("strong", { text: label + ": " }), value || ""]);
  }

  function openDetail(id) {
    selectedDetailId = id;
    if (map) map.closePopup();
    renderDetail();
    selectTab("tab-detail");
    $("tab-detail").focus();
  }

  // ----- Tabs -----

  var TAB_IDS = ["tab-map", "tab-directory", "tab-detail", "tab-export"];

  function selectTab(tabId) {
    TAB_IDS.forEach(function (id) {
      var tab = $(id);
      var active = id === tabId;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      $(tab.getAttribute("aria-controls")).hidden = !active;
    });
    if (tabId === "tab-map" && map) {
      // The map can't measure itself while hidden; refresh it when shown.
      setTimeout(function () {
        map.invalidateSize();
        if (!mapFitted) fitMap();
      }, 0);
    }
  }

  function setupTabs() {
    TAB_IDS.forEach(function (id, index) {
      var tab = $(id);
      tab.addEventListener("click", function () { selectTab(id); });
      tab.addEventListener("keydown", function (event) {
        var next = null;
        if (event.key === "ArrowRight") next = TAB_IDS[(index + 1) % TAB_IDS.length];
        if (event.key === "ArrowLeft") next = TAB_IDS[(index - 1 + TAB_IDS.length) % TAB_IDS.length];
        if (next) { event.preventDefault(); selectTab(next); $(next).focus(); }
      });
    });
    $("detail-select").addEventListener("change", function (event) {
      selectedDetailId = Number(event.target.value);
      renderDetail();
    });
    $("download").addEventListener("click", downloadCsv);
  }

  // ----- Export -----

  function downloadCsv() {
    // The leading ﻿ marker tells Excel the file is UTF-8, so dashes and
    // accented characters display correctly.
    var blob = new Blob(["﻿" + toCsv(filtered, EXPORT_COLUMNS)], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = el("a", { href: url, download: EXPORT_FILE_NAME });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---------------------------------------------------------------------------
  // Start-up
  // ---------------------------------------------------------------------------

  function showError(message, allowPicker) {
    var status = $("status");
    status.hidden = false;
    status.className = "status-message error";
    status.textContent = message;
    if (allowPicker) {
      var input = el("input", { type: "file", accept: ".csv,text/csv" });
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        if (!file) return;
        file.arrayBuffer().then(function (buffer) { start(decodeBytes(buffer)); })
          .catch(function (error) { showError("That file could not be read: " + error.message, true); });
      });
      status.appendChild(el("p", { text: "To preview the page on your own computer, choose the CSV file here:" }, []));
      status.appendChild(input);
    }
  }

  function start(text) {
    try {
      assets = buildAssets(text);
    } catch (error) {
      showError("The CSV could not be loaded. " + error.message, true);
      return;
    }

    var seen = {};
    categories = assets.map(function (a) { return a.Category; })
      .filter(function (c) { if (seen[c]) return false; seen[c] = true; return true; })
      .sort(compareText);

    var distances = assets.map(function (a) { return a["Distance (mi)"]; }).filter(hasNumber);
    // Round the slider maximum up to the next half mile so the farthest
    // resource is always included at the default setting.
    maxDistance = distances.length ? Math.ceil(Math.max.apply(null, distances) * 2) / 2 : 15;

    $("status").hidden = true;
    $("app").hidden = false;
    setupFilters();
    setupTabs();
    if (typeof L !== "undefined") {
      setupMap();
    } else {
      $("map").textContent = "The map library did not load. Check that the vendor/leaflet folder was uploaded.";
    }
    update();
  }

  function load() {
    fetch(DATA_FILE, { cache: "no-cache" })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.arrayBuffer();
      })
      .then(function (buffer) {
        // Errors inside start() are reported separately, not as a loading problem.
        setTimeout(function () { start(decodeBytes(buffer)); }, 0);
      })
      .catch(function (error) {
        var local = window.location.protocol === "file:";
        showError(
          local
            ? "Browsers block pages opened straight from your computer from reading other files, so the data could not load automatically."
            : "Could not load " + DATA_FILE + " (" + error.message + "). Keep it in the same folder as index.html.",
          local
        );
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
})();
