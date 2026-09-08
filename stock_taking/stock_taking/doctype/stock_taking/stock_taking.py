
# Copyright (c) 2025, bhumika.d@stackerbee.com and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt
from decimal import Decimal, ROUND_HALF_UP


class StockTaking(Document):

    # =========================================================
    # CANCEL
    # =========================================================

    def before_cancel(self):

        delivery_notes = frappe.get_all(
            "Delivery Note",
            filters={
                "custom_stock_taking": self.name
            },
            fields=[
                "name",
                "docstatus"
            ]
        )

        for dn in delivery_notes:

            # Submitted DN cannot be deleted
            if dn.docstatus == 1:

                frappe.throw(
                    _(
                        "Cannot cancel Stock Taking because "
                        "Delivery Note <b>{0}</b> is Submitted. "
                        "Please cancel it first."
                    ).format(dn.name)
                )

# =============================================================
# SCAN BARCODE
# =============================================================

@frappe.whitelist()
def scan_barcode(code, warehouses=None):

    try:

        if isinstance(warehouses, str):
            warehouses = frappe.parse_json(warehouses)

        warehouses = warehouses or []

        # -----------------------------------------------------
        # SERIAL SCAN
        # -----------------------------------------------------

        if frappe.db.exists(
            "Serial No",
            code
        ):

            serial = frappe.get_doc(
                "Serial No",
                code
            )

            return {
                "success": True,
                "type": "serial",
                "result": {
                    "name": serial.name,
                    "item_code": serial.item_code,
                    "warehouse": serial.warehouse,
                    "status": serial.status
                }
            }

        # -----------------------------------------------------
        # ITEM BARCODE
        # -----------------------------------------------------

        item_code = frappe.db.get_value(
            "Item Barcode",
            {
                "barcode": code
            },
            "parent"
        )

        # -----------------------------------------------------
        # DIRECT ITEM CODE
        # -----------------------------------------------------

        if not item_code:

            if frappe.db.exists(
                "Item",
                code
            ):
                item_code = code

        # -----------------------------------------------------
        # ITEM NOT FOUND
        # -----------------------------------------------------

        if not item_code:

            return {
                "success": False,
                "message": "No Serial or Item found"
            }

        warehouse = (
            warehouses[0]
            if warehouses
            else ""
        )

        # -----------------------------------------------------
        # BIN QTY
        # -----------------------------------------------------

        actual_qty = frappe.db.get_value(
            "Bin",
            {
                "item_code": item_code,
                "warehouse": warehouse
            },
            "actual_qty"
        ) or 0

        # -----------------------------------------------------
        # ACTIVE SERIALS
        # -----------------------------------------------------

        serial_filters = {
            "item_code": item_code,
            "status": "Active"
        }

        if warehouse:
            serial_filters["warehouse"] = warehouse

        serials = frappe.get_all(
            "Serial No",
            fields=["name"],
            filters=serial_filters,
            limit_page_length=0
        )

        return {
            "success": True,
            "type": "item",
            "result": [
                {
                    "item_code": item_code,
                    "warehouse": warehouse,
                    "actual_qty": actual_qty
                }
            ],
            "serials": [
                s.name
                for s in serials
            ]
        }

    except Exception:

        frappe.log_error(
            frappe.get_traceback(),
            "scan_barcode error"
        )

        return {
            "success": False,
            "message": "Scan failed"
        }


# =============================================================
# GET SYSTEM SERIALS
# =============================================================

@frappe.whitelist()
def get_system_serials(
    item_code,
    warehouse
):

    return frappe.get_all(
        "Serial No",
        pluck="name",
        filters={
            "item_code": item_code,
            "warehouse": warehouse,
            "status": "Active"
        },
        limit_page_length=0
    )


# =============================================================
# MAKE SERIAL ACTIVE
# =============================================================

@frappe.whitelist()
def make_serial_active(serials):

    if isinstance(serials, str):
        serials = frappe.parse_json(serials)

    for serial_no in serials or []:

        frappe.db.set_value(
            "Serial No",
            serial_no,
            "status",
            "Active"
        )


# =============================================================
# GET WAREHOUSE SERIALS
# =============================================================

@frappe.whitelist()
def get_warehouse_serials(warehouse):

    return frappe.db.sql(
        """
        SELECT
            name AS serial_no,
            item_code
        FROM `tabSerial No`
        WHERE
            warehouse = %s
            AND status = 'Active'
        """,
        warehouse,
        as_dict=True
    )


# =============================================================
# GET NON SERIALIZED STOCK
# =============================================================

@frappe.whitelist()
def get_non_serialized_stock(warehouse):

    return frappe.db.sql(
        """
        SELECT
            b.item_code,
            b.actual_qty
        FROM `tabBin` b
        INNER JOIN `tabItem` i
            ON i.name = b.item_code
        WHERE
            b.warehouse = %s
            AND b.actual_qty > 0
            AND IFNULL(i.has_serial_no, 0) = 0
        """,
        warehouse,
        as_dict=True
    )


# =============================================================
# OPTIMIZED STOCK TAKING ANALYSIS
#
# IMPORTANT:
# One API call per warehouse.
#
# Previously:
#   get_warehouse_serials
#   get_non_serialized_stock
#   get_system_serials
#   get_non_serialized_stock
#   get_system_serials
#   ...
#
# Now:
#   One call per warehouse
# =============================================================

@frappe.whitelist()
def analyze_stock_taking(
    warehouse,
    scanned_serials=None,
    scanned_items=None
):

    try:

        if isinstance(
            scanned_serials,
            str
        ):
            scanned_serials = frappe.parse_json(
                scanned_serials
            )

        if isinstance(
            scanned_items,
            str
        ):
            scanned_items = frappe.parse_json(
                scanned_items
            )

        scanned_serials = scanned_serials or []
        scanned_items = scanned_items or {}

        # -----------------------------------------------------
        # NORMALIZE SERIALS
        # -----------------------------------------------------

        scanned_serials = {
            str(s).strip()
            for s in scanned_serials
            if str(s).strip()
        }

        # -----------------------------------------------------
        # SYSTEM SERIALS
        # -----------------------------------------------------

        system_serial_rows = frappe.get_all(
            "Serial No",
            fields=[
                "name",
                "item_code"
            ],
            filters={
                "warehouse": warehouse,
                "status": "Active"
            },
            limit_page_length=0
        )

        system_serial_map = {}

        for row in system_serial_rows:

            system_serial_map[
                row.item_code
            ] = system_serial_map.get(
                row.item_code,
                set()
            )

            system_serial_map[
                row.item_code
            ].add(row.name)

        # -----------------------------------------------------
        # MISSING SERIALS
        # -----------------------------------------------------

        issue_items = []

        for row in system_serial_rows:

            serial_no = row.name

            if serial_no not in scanned_serials:

                issue_items.append({
                    "item_code": row.item_code,
                    "warehouse": warehouse,
                    "serial_no": serial_no,
                    "qty": 1
                })

        # -----------------------------------------------------
        # NON SERIALIZED STOCK
        # -----------------------------------------------------

        stock_rows = frappe.db.sql(
            """
            SELECT
                b.item_code,
                b.actual_qty
            FROM `tabBin` b
            INNER JOIN `tabItem` i
                ON i.name = b.item_code
            WHERE
                b.warehouse = %s
                AND b.actual_qty > 0
                AND IFNULL(i.has_serial_no, 0) = 0
            """,
            warehouse,
            as_dict=True
        )

        stock_map = {
            row.item_code: flt(
                row.actual_qty
            )
            for row in stock_rows
        }

        # -----------------------------------------------------
        # MISSING NON SERIALIZED
        # -----------------------------------------------------

        for row in stock_rows:

            item_code = row.item_code

            scanned_qty = flt(
                scanned_items.get(
                    item_code,
                    0
                )
            )

            system_qty = flt(
                row.actual_qty
            )

            difference = (
                system_qty
                - scanned_qty
            )

            if difference > 0:

                issue_items.append({
                    "item_code": item_code,
                    "warehouse": warehouse,
                    "serial_no": "",
                    "qty": difference
                })

        # -----------------------------------------------------
        # EXTRA STOCK
        # -----------------------------------------------------

        receipt_items = []

        for item_code, data in (
            scanned_items.items()
        ):

            physical_qty = flt(
                data.get("physical_count", 0)
            )

            item_serials = data.get(
                "serials",
                []
            )

            # -------------------------------------------------
            # SERIALIZED
            # -------------------------------------------------

            if item_serials:

                system_serials = (
                    system_serial_map.get(
                        item_code,
                        set()
                    )
                )

                extra_serials = [
                    s
                    for s in item_serials
                    if s not in system_serials
                ]

                if extra_serials:

                    receipt_items.append({
                        "item_code": item_code,
                        "warehouse": warehouse,
                        "serial_no": "\n".join(
                            sorted(
                                set(
                                    extra_serials
                                )
                            )
                        ),
                        "qty": len(
                            set(extra_serials)
                        )
                    })

            # -------------------------------------------------
            # NON SERIALIZED
            # -------------------------------------------------

            else:

                system_qty = stock_map.get(
                    item_code,
                    0
                )

                extra_qty = (
                    physical_qty
                    - system_qty
                )

                if extra_qty > 0:

                    receipt_items.append({
                        "item_code": item_code,
                        "warehouse": warehouse,
                        "serial_no": "",
                        "qty": extra_qty
                    })

        return {
            "success": True,
            "issue_items": issue_items,
            "receipt_items": receipt_items
        }

    except Exception:

        frappe.log_error(
            frappe.get_traceback(),
            "analyze_stock_taking error"
        )

        frappe.throw(
            _(
                "Stock Taking analysis failed: {0}"
            ).format(
                frappe.get_traceback()
            )
        )


# =============================================================
# ITEM DELIVERY RATE MAP
#
# ONE QUERY FOR ALL ITEMS
# =============================================================

def get_item_delivery_rate_map(
    item_codes,
    company
):

    item_codes = list(
        {
            item
            for item in item_codes
            if item
        }
    )

    if not item_codes:
        return {}

    placeholders = ", ".join(
        ["%s"] * len(item_codes)
    )

    values = [
        company
    ] + item_codes

    result = frappe.db.sql(
        f"""
        SELECT
            pri.item_code,
            pri.base_price_list_rate AS mrp
        FROM `tabPurchase Receipt Item` pri
        INNER JOIN `tabPurchase Receipt` pr
            ON pr.name = pri.parent
        WHERE
            pr.company = %s
            AND pr.docstatus = 1
            AND pri.item_code IN ({placeholders})
            AND IFNULL(
                pri.base_price_list_rate,
                0
            ) > 0
        ORDER BY
            pr.posting_date DESC,
            pr.posting_time DESC,
            pr.creation DESC
        """,
        values,
        as_dict=True
    )

    rate_map = {}

    for row in result:

        if row.item_code not in rate_map:

            rate_map[
                row.item_code
            ] = row.mrp

    # ---------------------------------------------------------
    # OPENING STOCK FALLBACK
    # ---------------------------------------------------------

    missing_items = [
        item
        for item in item_codes
        if item not in rate_map
    ]

    if missing_items:

        placeholders = ", ".join(
            ["%s"] * len(missing_items)
        )

        values = [
            company
        ] + missing_items

        result = frappe.db.sql(
            f"""
            SELECT
                sri.item_code,
                sri.valuation_rate AS mrp
            FROM `tabStock Reconciliation Item` sri
            INNER JOIN `tabStock Reconciliation` sr
                ON sr.name = sri.parent
            WHERE
                sr.company = %s
                AND sr.purpose = 'Opening Stock'
                AND sr.docstatus = 1
                AND sri.item_code IN ({placeholders})
                AND IFNULL(
                    sri.valuation_rate,
                    0
                ) > 0
            ORDER BY
                sr.posting_date DESC,
                sr.posting_time DESC,
                sr.creation DESC
            """,
            values,
            as_dict=True
        )

        for row in result:

            if row.item_code not in rate_map:

                rate_map[
                    row.item_code
                ] = row.mrp

    return rate_map


# =============================================================
# CREATE DELIVERY NOTE
#
# MATERIAL ISSUE REPLACEMENT
# =============================================================

@frappe.whitelist()
def create_delivery_note(doc):
    import json
    from decimal import Decimal, ROUND_HALF_UP

    # =========================================================
    # PARSE DOCUMENT
    # =========================================================

    if isinstance(doc, str):
        doc = json.loads(doc)

    if not doc:
        frappe.throw(_("Delivery Note data is required."))

    # =========================================================
    # STOCK TAKING
    # =========================================================

    stock_taking_name = (
        doc.get("custom_stock_taking")
        or doc.get("stock_taking")
    )

    if not stock_taking_name:
        frappe.throw(_("Stock Taking reference is required."))

    # Only required fields instead of loading complete document
    stock_taking = frappe.db.get_value(
        "Stock Taking",
        stock_taking_name,
        ["company"],
        as_dict=True
    )

    if not stock_taking:
        frappe.throw(
            _("Stock Taking {0} not found.").format(
                stock_taking_name
            )
        )

    company = stock_taking.company

    if not company:
        frappe.throw(
            _("Company is required in Stock Taking.")
        )

    # =========================================================
    # CUSTOMER
    # =========================================================

    customer = frappe.db.get_value(
        "Stock Taking Customer",
        {
            "parent": "Stock Taking Settings",
            "parenttype": "Stock Taking Settings",
            "parentfield": "stock_taking_customer",
            "company": company
        },
        "customer"
    )

    if not customer:
        frappe.throw(
            _(
                "Please add Company <b>{0}</b> "
                "and its Customer in Stock Taking Settings."
            ).format(company)
        )

    # =========================================================
    # DEFAULT WAREHOUSE
    # =========================================================

    default_warehouse = frappe.db.get_value(
        "stock taking Warehouse",
        {
            "parent": stock_taking_name,
            "parenttype": "Stock Taking",
            "parentfield": "warehouse"
        },
        "warehuose",
        order_by="idx asc"
    )

    if not default_warehouse:
        frappe.throw(
            _(
                "No Warehouse found in Stock Taking {0}."
            ).format(stock_taking_name)
        )

    # =========================================================
    # CREATE DOCUMENT
    # =========================================================

    dn = frappe.get_doc(doc)

    dn.company = company
    dn.customer = customer

    dn.is_return = 0
    dn.return_against = None

    # IMPORTANT:
    # Prevent internal transfer validation
    dn.is_internal_customer = 0
    dn.represents_company = None

    dn.set_warehouse = default_warehouse

    # =========================================================
    # SIS CONFIGURATION
    # =========================================================

    config = frappe.db.get_value(
        "SIS Configuration",
        {"company": company},
        [
            "fresh_margin",
            "discounted_margin",
            "output_gst_min_net_rate"
        ],
        as_dict=True
    )

    if not config:
        frappe.throw(
            _(
                "SIS Configuration not found "
                "for Company: {0}"
            ).format(company)
        )

    fresh_margin = Decimal(
        str(config.fresh_margin or 0)
    )

    output_gst_min_net_rate = Decimal(
        str(config.output_gst_min_net_rate or 0)
    )

    # =========================================================
    # ITEM CODES
    # =========================================================

    item_codes = list({
        item.item_code
        for item in dn.items
        if item.item_code
    })

    # =========================================================
    # BATCH MRP
    # =========================================================

    rate_map = {}

    if item_codes:
        rate_map = get_item_delivery_rate_map(
            item_codes,
            company
        ) or {}

    # =========================================================
    # DECIMAL HELPERS
    # =========================================================

    def D(value):
        return Decimal(str(value or 0))

    def R2(value):
        return value.quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP
        )

    # =========================================================
    # PROCESS ALL ITEMS
    # =========================================================

    for idx, item in enumerate(dn.items, start=1):

        # -----------------------------------------------------
        # WAREHOUSE
        # -----------------------------------------------------

        item.warehouse = default_warehouse

        if hasattr(item, "target_warehouse"):
            item.target_warehouse = None

        if hasattr(item, "from_warehouse"):
            item.from_warehouse = None

        # -----------------------------------------------------
        # QUANTITY
        # -----------------------------------------------------

        qty = D(item.qty)

        if qty <= 0:
            continue

        # -----------------------------------------------------
        # MRP
        # -----------------------------------------------------

        mrp = D(
            rate_map.get(
                item.item_code,
                0
            )
        )

        if mrp <= 0:
            frappe.throw(
                _(
                    "MRP not found for Item "
                    "<b>{0}</b> in submitted "
                    "Purchase Receipt / Opening Stock "
                    "for Company <b>{1}</b>."
                ).format(
                    item.item_code,
                    company
                )
            )

        item.rate = float(mrp)
        item.price_list_rate = float(mrp)

        # -----------------------------------------------------
        # TAXABLE
        # -----------------------------------------------------

        taxable = R2(
            mrp * qty
        )

        # -----------------------------------------------------
        # GST
        # -----------------------------------------------------

        if abs(taxable) <= output_gst_min_net_rate:
            gst_percent = Decimal("5")
        else:
            gst_percent = Decimal("18")

        gst_value = R2(
            taxable
            * gst_percent
            / (Decimal("100") + gst_percent)
        )

        net_sale_value = R2(
            taxable - gst_value
        )

        margin_value = R2(
            taxable
            * fresh_margin
            / Decimal("100")
        )

        # -----------------------------------------------------
        # CUSTOM VALUES
        # -----------------------------------------------------

        item.custom_output_gst_ = float(gst_percent)

        item.custom_output_gst_value = float(
            gst_value
        )

        item.custom_net_sale_value = float(
            net_sale_value
        )

        item.custom_margin_amount = float(
            margin_value
        )

        item.custom_margins_ = float(
            fresh_margin
        )

        item.custom_total_invoice_amount = float(
            taxable
        )

    # =========================================================
    # INSERT DRAFT
    # =========================================================

    # Keep document as Draft
    dn.docstatus = 0

    dn.flags.ignore_permissions = True
    dn.flags.ignore_mandatory = True
    dn.flags.ignore_links = True

    dn.insert(
        ignore_permissions=True,
        ignore_mandatory=True
    )

    return {
        "name": dn.name,
        "doctype": "Delivery Note",
        "docstatus": dn.docstatus
    }


# =============================================================
# CREATE DELIVERY NOTE RETURN
# =============================================================
# =============================================================
# CREATE DELIVERY NOTE RETURN
# =============================================================

@frappe.whitelist()
def create_delivery_note_return(doc):
    import json
    from decimal import Decimal, ROUND_HALF_UP

    # =========================================================
    # PARSE DOCUMENT
    # =========================================================

    if isinstance(doc, str):
        doc = json.loads(doc)

    if not doc:
        frappe.throw(
            _("Delivery Note data is required.")
        )

    # =========================================================
    # STOCK TAKING
    # =========================================================

    stock_taking_name = (
        doc.get("custom_stock_taking")
        or doc.get("stock_taking")
    )

    if not stock_taking_name:
        frappe.throw(
            _("Stock Taking reference is required.")
        )

    stock_taking = frappe.db.get_value(
        "Stock Taking",
        stock_taking_name,
        ["company"],
        as_dict=True
    )

    if not stock_taking:
        frappe.throw(
            _("Stock Taking {0} not found.").format(
                stock_taking_name
            )
        )

    company = stock_taking.company

    if not company:
        frappe.throw(
            _("Company is required in Stock Taking.")
        )

    # =========================================================
    # CUSTOMER
    # =========================================================

    customer = frappe.db.get_value(
        "Stock Taking Customer",
        {
            "parent": "Stock Taking Settings",
            "parenttype": "Stock Taking Settings",
            "parentfield": "stock_taking_customer",
            "company": company
        },
        "customer"
    )

    if not customer:
        frappe.throw(
            _(
                "Customer is not configured in "
                "Stock Taking Settings for company {0}."
            ).format(company)
        )

    # =========================================================
    # DEFAULT WAREHOUSE
    # =========================================================

    default_warehouse = frappe.db.get_value(
        "stock taking Warehouse",
        {
            "parent": stock_taking_name,
            "parenttype": "Stock Taking",
            "parentfield": "warehouse"
        },
        "warehuose",
        order_by="idx asc"
    )

    # Fallback: use warehouse from incoming document items
    if not default_warehouse:

        for row in (doc.get("items") or []):

            if row.get("warehouse"):
                default_warehouse = row.get("warehouse")
                break

    if not default_warehouse:
        frappe.throw(
            _(
                "Warehouse is required to create "
                "Delivery Note Return."
            )
        )

    # =========================================================
    # CREATE DOCUMENT
    # =========================================================

    dn = frappe.get_doc(doc)

    dn.company = company
    dn.customer = customer

    # =========================================================
    # FIND ORIGINAL SUBMITTED NORMAL DELIVERY NOTE
    # =========================================================
    #
    # Stock Taking se pehle jo NORMAL Delivery Note bana hai
    # aur submit ho chuka hai, uska name yahan milega.
    #
    # Example:
    #
    # Stock Taking:
    # ST-26-27-00015
    #
    # Normal Delivery Note:
    # DN-26-27-00125
    #
    # Return Delivery Note:
    # return_against = DN-26-27-00125
    #
    # =========================================================

    original_dn = frappe.db.get_value(
        "Delivery Note",
        {
            "custom_stock_taking": stock_taking_name,
            "company": company,
            "is_return": 0,
            "docstatus": 1
        },
        "name",
        order_by="creation desc"
    )

    if not original_dn:
        frappe.throw(
            _(
                "Submitted normal Delivery Note not found "
                "for Stock Taking {0}. "
                "Please submit the normal Delivery Note "
                "before creating the Return Delivery Note."
            ).format(
                stock_taking_name
            )
        )

    # =========================================================
    # RETURN DELIVERY NOTE SETTINGS
    # =========================================================

    dn.is_return = 1

    # IMPORTANT:
    # Return Against mein Stock Taking ID nahi jayegi.
    # Yahan ORIGINAL SUBMITTED DELIVERY NOTE ka name jayega.
    #
    # Example:
    # dn.return_against = "DN-26-27-00125"
    #
    dn.return_against = original_dn

    # Prevent internal transfer validation
    dn.is_internal_customer = 0
    dn.represents_company = None

    dn.set_warehouse = default_warehouse

    # =========================================================
    # SIS CONFIGURATION
    # =========================================================

    config = frappe.db.get_value(
        "SIS Configuration",
        {"company": company},
        [
            "fresh_margin",
            "discounted_margin",
            "output_gst_min_net_rate"
        ],
        as_dict=True
    )

    if not config:
        frappe.throw(
            _(
                "SIS Configuration not found "
                "for Company: {0}"
            ).format(company)
        )

    fresh_margin = Decimal(
        str(config.fresh_margin or 0)
    )

    output_gst_min_net_rate = Decimal(
        str(config.output_gst_min_net_rate or 0)
    )

    # =========================================================
    # ITEM CODES
    # =========================================================

    item_codes = list({
        item.item_code
        for item in dn.items
        if item.item_code
    })

    rate_map = {}

    if item_codes:
        rate_map = get_item_delivery_rate_map(
            item_codes,
            company
        ) or {}

    # =========================================================
    # DECIMAL HELPERS
    # =========================================================

    def D(value):
        return Decimal(str(value or 0))

    def R2(value):
        return value.quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP
        )

    # =========================================================
    # PROCESS ITEMS
    # =========================================================

    for idx, item in enumerate(dn.items, start=1):

        # -----------------------------------------------------
        # WAREHOUSE
        # -----------------------------------------------------

        item.warehouse = (
            item.warehouse
            or default_warehouse
        )

        # Return DN ko internal transfer na banne dein
        if hasattr(item, "target_warehouse"):
            item.target_warehouse = None

        if hasattr(item, "from_warehouse"):
            item.from_warehouse = None

        # -----------------------------------------------------
        # QUANTITY
        # -----------------------------------------------------

        qty = D(item.qty)

        # Return DN mein quantity negative honi chahiye
        if qty > 0:
            qty = -qty

        if qty == 0:
            frappe.throw(
                _(
                    "Row {0}: Quantity is required "
                    "for Item {1}."
                ).format(
                    idx,
                    item.item_code
                )
            )

        item.qty = float(qty)

        # -----------------------------------------------------
        # MRP
        # -----------------------------------------------------

        mrp = D(
            rate_map.get(
                item.item_code,
                0
            )
        )

        if mrp <= 0:
            frappe.throw(
                _(
                    "MRP not found for Item "
                    "<b>{0}</b>."
                ).format(
                    item.item_code
                )
            )

        item.rate = float(mrp)
        item.price_list_rate = float(mrp)

        # -----------------------------------------------------
        # TAXABLE
        # -----------------------------------------------------

        taxable = R2(
            mrp * qty
        )

        # -----------------------------------------------------
        # GST
        # -----------------------------------------------------

        if abs(taxable) <= output_gst_min_net_rate:
            gst_percent = Decimal("5")
        else:
            gst_percent = Decimal("18")

        gst_value = R2(
            taxable
            * gst_percent
            / (Decimal("100") + gst_percent)
        )

        net_sale_value = R2(
            taxable - gst_value
        )

        margin_value = R2(
            taxable
            * fresh_margin
            / Decimal("100")
        )

        # -----------------------------------------------------
        # VALUES
        # -----------------------------------------------------

        item.amount = float(taxable)

        item.custom_output_gst_ = float(
            gst_percent
        )

        item.custom_output_gst_value = float(
            gst_value
        )

        item.custom_net_sale_value = float(
            net_sale_value
        )

        item.custom_margin_amount = float(
            margin_value
        )

        item.custom_margins_ = float(
            fresh_margin
        )

        item.custom_total_invoice_amount = float(
            taxable
        )

    # =========================================================
    # INSERT DRAFT
    # =========================================================

    dn.docstatus = 0

    dn.flags.ignore_permissions = True
    dn.flags.ignore_mandatory = True
    dn.flags.ignore_links = True

    dn.insert(
        ignore_permissions=True,
        ignore_mandatory=True
    )

    # =========================================================
    # RETURN RESPONSE
    # =========================================================

    return {
        "name": dn.name,
        "doctype": "Delivery Note",
        "docstatus": dn.docstatus,
        "is_return": dn.is_return,
        "return_against": dn.return_against,
        "customer": dn.customer,
        "company": dn.company,
        "set_warehouse": dn.set_warehouse
    }