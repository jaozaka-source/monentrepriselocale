/// <reference path="../pb_data/types.d.ts" />

// Automatic Stripe Customer synchronization for client_profiles.
//
// Fires after a profile is created and after it is updated. Keeps the Stripe
// Customer record in sync with the profile's company name, account email,
// phone, address (split into line1 / postal_code / city / country) and EU VAT
// number. All Stripe calls go through the Stripe REST API via $http.send using
// STRIPE_SECRET_KEY read from the environment — the key never leaves the
// server.
//
// Best-effort by design: a Stripe failure is logged but NEVER blocks the
// profile create/update (the user's data is already saved). The Node-side
// checkout flow (stripe.server.ts → ensureStripeCustomer) is the reliable
// fallback that creates the customer at payment time if it is still missing,
// using the same idempotency key (profile-<id>) and the same field mapping.
//
// Test/live mode: the active key's mode (sk_live_* vs sk_test_*) is stored as
// `stripe_livemode` next to the customer id. If the stored mode no longer
// matches the active key, the customer is recreated.
//
// NOTE: PocketBase runs each hook callback in an isolated JSVM scope, so every
// helper is defined INSIDE the callback that uses it.

onRecordAfterCreateSuccess((e) => {
  var STRIPE_API = "https://api.stripe.com/v1";

  function stripeKey() { return $os.getenv("STRIPE_SECRET_KEY") || ""; }
  function isLiveMode(key) { return String(key).indexOf("sk_live") === 0; }

  function parseAddress(addr) {
    if (!addr) return { line1: "", postal_code: "", city: "" };
    var s = String(addr).trim().replace(/\s+/g, " ");
    var m = s.match(/^(.*?)\s+(\d{5})\s+(.+)$/);
    if (m) return { line1: m[1].trim(), postal_code: m[2], city: m[3].trim() };
    return { line1: s, postal_code: "", city: "" };
  }

  function encVal(v) { return encodeURIComponent(String(v)); }
  function encKey(k) {
    return encodeURIComponent(String(k)).replace(/%5B/g, "[").replace(/%5D/g, "]");
  }
  function buildForm(pairs) {
    var out = [];
    for (var i = 0; i < pairs.length; i++) {
      var v = pairs[i][1];
      if (v === null || v === undefined || v === "") continue;
      out.push(encKey(pairs[i][0]) + "=" + encVal(v));
    }
    return out.join("&");
  }

  function stripeRequest(key, method, path, formPairs, idempotencyKey) {
    var headers = { Authorization: "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    var opts = { url: STRIPE_API + path, method: method, headers: headers };
    if (formPairs && formPairs.length) opts.body = buildForm(formPairs);
    try { return $http.send(opts); } catch (err) { return { statusCode: 0, body: String(err) }; }
  }

  function parseJson(body) { try { return JSON.parse(body || "{}"); } catch (_) { return {}; } }

  function ownerEmail(ownerId) {
    if (!ownerId) return "";
    try { var u = $app.findRecordById("users", ownerId); return u ? u.getString("email") : ""; } catch (_) { return ""; }
  }

  function customerName(record) {
    var company = record.getString("company_name");
    if (company) return company;
    var first = record.getString("rep_firstname");
    var last = record.getString("rep_lastname");
    var name = (first + " " + last).trim();
    return name || record.getString("trade_name") || "";
  }

  function customerParams(record, ownerMail) {
    var addr = parseAddress(record.getString("hq_address"));
    return [
      ["name", customerName(record)],
      ["email", ownerMail],
      ["phone", record.getString("phone") || record.getString("rep_mobile") || ""],
      ["address[line1]", addr.line1],
      ["address[postal_code]", addr.postal_code],
      ["address[city]", addr.city],
      ["address[country]", "FR"],
      ["preferred_locales[0]", "fr"],
      ["metadata[pocketbase_user_id]", record.getString("owner")],
      ["metadata[profile_id]", record.id],
    ];
  }

  function addTaxId(key, customerId, vatNumber) {
    if (!vatNumber) return;
    stripeRequest(key, "POST", "/customers/" + customerId + "/tax_ids", [["type", "eu_vat"], ["value", vatNumber]], null);
  }

  function syncCustomer(record) {
    var key = stripeKey();
    if (!key) {
      $app.logger().warn("stripe-customer-sync: STRIPE_SECRET_KEY not set in PocketBase env — skipping (Node checkout fallback will create the customer).");
      return;
    }
    var live = isLiveMode(key);
    var cid = record.getString("stripe_customer_id");
    var recLive = record.getBool("stripe_livemode");
    var ownerMail = ownerEmail(record.getString("owner"));
    var vat = record.getString("vat_number");
    var modeMismatch = cid && recLive !== live;

    if (!cid || modeMismatch) {
      var res = stripeRequest(key, "POST", "/customers", customerParams(record, ownerMail), "profile-" + record.id);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        var cust = parseJson(res.body);
        if (cust.id) {
          record.set("stripe_customer_id", cust.id);
          record.set("stripe_livemode", live);
          try { $app.save(record); } catch (err) { $app.logger().error("stripe-customer-sync: persist failed", "err", String(err)); }
          if (vat) { try { addTaxId(key, cust.id, vat); } catch (e) { $app.logger().error("stripe-customer-sync: addTaxId failed", "err", String(e)); } }
        } else {
          $app.logger().error("stripe-customer-sync: create returned no id", "body", res.body);
        }
      } else {
        $app.logger().error("stripe-customer-sync: customer create failed", "status", res.statusCode, "body", res.body);
      }
      return;
    }

    var res2 = stripeRequest(key, "POST", "/customers/" + cid, customerParams(record, ownerMail), null);
    if (res2.statusCode < 200 || res2.statusCode >= 300) {
      $app.logger().error("stripe-customer-sync: customer update failed", "status", res2.statusCode, "body", res2.body);
    }
  }

  try { syncCustomer(e.record); } catch (err) { $app.logger().error("stripe-customer-sync: create hook error", "err", String(err)); }
  e.next();
}, "client_profiles");

onRecordAfterUpdateSuccess((e) => {
  var STRIPE_API = "https://api.stripe.com/v1";

  function stripeKey() { return $os.getenv("STRIPE_SECRET_KEY") || ""; }
  function isLiveMode(key) { return String(key).indexOf("sk_live") === 0; }

  function parseAddress(addr) {
    if (!addr) return { line1: "", postal_code: "", city: "" };
    var s = String(addr).trim().replace(/\s+/g, " ");
    var m = s.match(/^(.*?)\s+(\d{5})\s+(.+)$/);
    if (m) return { line1: m[1].trim(), postal_code: m[2], city: m[3].trim() };
    return { line1: s, postal_code: "", city: "" };
  }

  function encVal(v) { return encodeURIComponent(String(v)); }
  function encKey(k) {
    return encodeURIComponent(String(k)).replace(/%5B/g, "[").replace(/%5D/g, "]");
  }
  function buildForm(pairs) {
    var out = [];
    for (var i = 0; i < pairs.length; i++) {
      var v = pairs[i][1];
      if (v === null || v === undefined || v === "") continue;
      out.push(encKey(pairs[i][0]) + "=" + encVal(v));
    }
    return out.join("&");
  }

  function stripeRequest(key, method, path, formPairs, idempotencyKey) {
    var headers = { Authorization: "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    var opts = { url: STRIPE_API + path, method: method, headers: headers };
    if (formPairs && formPairs.length) opts.body = buildForm(formPairs);
    try { return $http.send(opts); } catch (err) { return { statusCode: 0, body: String(err) }; }
  }

  function parseJson(body) { try { return JSON.parse(body || "{}"); } catch (_) { return {}; } }

  function ownerEmail(ownerId) {
    if (!ownerId) return "";
    try { var u = $app.findRecordById("users", ownerId); return u ? u.getString("email") : ""; } catch (_) { return ""; }
  }

  function customerName(record) {
    var company = record.getString("company_name");
    if (company) return company;
    var first = record.getString("rep_firstname");
    var last = record.getString("rep_lastname");
    var name = (first + " " + last).trim();
    return name || record.getString("trade_name") || "";
  }

  function customerParams(record, ownerMail) {
    var addr = parseAddress(record.getString("hq_address"));
    return [
      ["name", customerName(record)],
      ["email", ownerMail],
      ["phone", record.getString("phone") || record.getString("rep_mobile") || ""],
      ["address[line1]", addr.line1],
      ["address[postal_code]", addr.postal_code],
      ["address[city]", addr.city],
      ["address[country]", "FR"],
      ["preferred_locales[0]", "fr"],
      ["metadata[pocketbase_user_id]", record.getString("owner")],
      ["metadata[profile_id]", record.id],
    ];
  }

  function listTaxIds(key, customerId) {
    var res = stripeRequest(key, "GET", "/customers/" + customerId + "/tax_ids", [], null);
    if (res.statusCode < 200 || res.statusCode >= 300) return [];
    return parseJson(res.body).data || [];
  }
  function addTaxId(key, customerId, vatNumber) {
    if (!vatNumber) return;
    stripeRequest(key, "POST", "/customers/" + customerId + "/tax_ids", [["type", "eu_vat"], ["value", vatNumber]], null);
  }
  function deleteTaxId(key, customerId, taxId) {
    stripeRequest(key, "DELETE", "/customers/" + customerId + "/tax_ids/" + taxId, [], null);
  }
  function reconcileTaxIds(key, customerId, vatNumber) {
    var existing = listTaxIds(key, customerId);
    var has = false;
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].type === "eu_vat" && existing[i].value === vatNumber) has = true;
    }
    if (has) return;
    for (var j = 0; j < existing.length; j++) {
      if (existing[j].type === "eu_vat") deleteTaxId(key, customerId, existing[j].id);
    }
    if (vatNumber) addTaxId(key, customerId, vatNumber);
  }

  function syncCustomer(record) {
    var key = stripeKey();
    if (!key) {
      $app.logger().warn("stripe-customer-sync: STRIPE_SECRET_KEY not set in PocketBase env — skipping update sync.");
      return;
    }
    var live = isLiveMode(key);
    var cid = record.getString("stripe_customer_id");
    var recLive = record.getBool("stripe_livemode");
    var ownerMail = ownerEmail(record.getString("owner"));
    var vat = record.getString("vat_number");
    var modeMismatch = cid && recLive !== live;

    if (!cid || modeMismatch) {
      var res = stripeRequest(key, "POST", "/customers", customerParams(record, ownerMail), "profile-" + record.id);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        var cust = parseJson(res.body);
        if (cust.id) {
          record.set("stripe_customer_id", cust.id);
          record.set("stripe_livemode", live);
          try { $app.save(record); } catch (err) { $app.logger().error("stripe-customer-sync: persist failed", "err", String(err)); }
          if (vat) { try { addTaxId(key, cust.id, vat); } catch (e) { $app.logger().error("stripe-customer-sync: addTaxId failed", "err", String(e)); } }
        } else {
          $app.logger().error("stripe-customer-sync: create returned no id", "body", res.body);
        }
      } else {
        $app.logger().error("stripe-customer-sync: customer create failed", "status", res.statusCode, "body", res.body);
      }
      return;
    }

    var res2 = stripeRequest(key, "POST", "/customers/" + cid, customerParams(record, ownerMail), null);
    if (res2.statusCode >= 200 && res2.statusCode < 300) {
      try { reconcileTaxIds(key, cid, vat); } catch (e) { $app.logger().error("stripe-customer-sync: reconcileTaxIds failed", "err", String(e)); }
    } else {
      $app.logger().error("stripe-customer-sync: customer update failed", "status", res2.statusCode, "body", res2.body);
    }
  }

  function relevantChanged(record, original) {
    if (!original) return true;
    var fields = ["company_name", "trade_name", "rep_firstname", "rep_lastname", "phone", "rep_mobile", "hq_address", "vat_number", "owner"];
    for (var i = 0; i < fields.length; i++) {
      if (record.getString(fields[i]) !== original.getString(fields[i])) return true;
    }
    return false;
  }

  try {
    if (relevantChanged(e.record, e.originalRecord)) syncCustomer(e.record);
  } catch (err) { $app.logger().error("stripe-customer-sync: update hook error", "err", String(err)); }
  e.next();
}, "client_profiles");
