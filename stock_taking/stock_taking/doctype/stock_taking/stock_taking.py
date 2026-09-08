# Copyright (c) 2025, bhumika.d@stackerbee.com and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt
from decimal import Decimal, ROUND_HALF_UP


class StockTaking(Document):

    # =========================================================
    # BEFORE CANCEL
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

            if dn.docstatus == 1:

                frappe.throw(
                    _(
                        "Cannot cancel Stock Taking because "
                        "Delivery Note <b>{0}</b> is Submitted. "
                        "Please cancel it first."
                    ).format(
                        dn.name
                    )
                )

    # =========================================================
    # ON SUBMIT
    #
    # Only enqueue heavy processing.
    # This makes Stock Taking submit much faster.
    # =========================================================

    def on_submit(self):

        frappe.enqueue(
            "stock_taking.stock_taking.doctype.stock_taking.stock_taking.process_stock_taking",
            stock_taking_name=self.name,
            queue="long",
            enqueue_after_commit=True,
            job_name=f"Process Stock Taking {self.name}"
        )

        frappe.msgprint(
            _(
                "Stock Taking <b>{0}</b> submitted successfully.<br><br>"
                "Stock analysis and Delivery Notes are being created "
                "in the background."
            ).format(
                self.name
            ),
            indicator="blue"
        )


# =============================================================
# PROCESS STOCK TAKING
#
# Heavy processing runs in background.
# =============================================================

def process_stock_taking(stock_taking_name):

    try:

        # =====================================================
        # LOAD STOCK TAKING
        # =====================================================

        stock_taking = frappe.get_doc(
            "Stock Taking",
            stock_taking_name
        )

        warehouse_data = {}

        # =====================================================
        # BUILD SCANNED DATA
        # =====================================================

        for row in stock_taking.items or []:

            warehouse = row.warehouse

            if not warehouse:

                frappe.throw(
                    _(
                        "Warehouse is mandatory for Item Row {0}."
                    ).format(
                        row.idx
                    )
                )

            if warehouse not in warehouse_data:

                warehouse_data[warehouse] = {
                    "scanned_serials": set(),
                    "scanned_items": {}
                }

            # -------------------------------------------------
            # SERIAL NUMBERS
            # -------------------------------------------------

            serials = []

            if row.serial_no:

                serials = [
                    serial.strip()
                    for serial in str(
                        row.serial_no
                    ).split("\n")
                    if serial.strip()
                ]

            warehouse_data[
                warehouse
            ][
                "scanned_serials"
            ].update(
                serials
            )

            # -------------------------------------------------
            # ITEM
            # -------------------------------------------------

            item_code = row.item_code

            if not item_code:
                continue

            if item_code not in warehouse_data[
                warehouse
            ][
                "scanned_items"
            ]:

                warehouse_data[
                    warehouse
                ][
                    "scanned_items"
                ][
                    item_code
                ] = {
                    "physical_count": 0,
                    "serials": []
                }

            item_data = warehouse_data[
                warehouse
            ][
                "scanned_items"
            ][
                item_code
            ]

            item_data[
                "physical_count"
            ] += flt(
                row.physical_count or 0
            )

            item_data[
                "serials"
            ].extend(
                serials
            )

        # =====================================================
        # REMOVE DUPLICATE SERIALS
        # =====================================================

        for warehouse, data in warehouse_data.items():

            for item_code, item_data in data[
                "scanned_items"
            ].items():

                item_data[
                    "serials"
                ] = list(
                    dict.fromkeys(
                        item_data[
                            "serials"
                        ]
                    )
                )

        # =====================================================
        # ANALYZE STOCK
        # =====================================================

        all_issue_items = []
        all_receipt_items = []

        for warehouse, data in warehouse_data.items():

            result = analyze_stock_taking(
                warehouse=warehouse,
                scanned_serials=frappe.as_json(
                    list(
                        data[
                            "scanned_serials"
                        ]
                    )
                ),
                scanned_items=frappe.as_json(
                    data[
                        "scanned_items"
                    ]
                )
            )

            if not result or not result.get("success"):

                frappe.throw(
                    _(
                        "Stock Taking analysis failed "
                        "for Warehouse <b>{0}</b>."
                    ).format(
                        warehouse
                    )
                )

            if result.get("issue_items"):

                all_issue_items.extend(
                    result.get(
                        "issue_items"
                    )
                )

            if result.get("receipt_items"):

                all_receipt_items.extend(
                    result.get(
                        "receipt_items"
                    )
                )

        # =====================================================
        # CREATE NORMAL DELIVERY NOTE - DRAFT
        # =====================================================

        normal_dn = None

        if all_issue_items:

            normal_dn = create_delivery_note(
                frappe.as_json({
                    "stock_taking_name": stock_taking_name,
                    "items": all_issue_items
                })
            )

        # =====================================================
        # CREATE RETURN DELIVERY NOTE - DRAFT
        #
        # IMPORTANT:
        # return_against will remain blank initially.
        #
        # It will be updated automatically when the normal
        # Delivery Note is submitted.
        # =====================================================

        return_dn = None

        if all_receipt_items:

            return_dn = create_delivery_note_return(
                frappe.as_json({
                    "stock_taking_name": stock_taking_name,
                    "items": all_receipt_items
                })
            )

        # =====================================================
        # LOG RESULT
        # =====================================================

        if normal_dn and return_dn:

            frappe.publish_realtime(
                "msgprint",
                {
                    "message": _(
                        "Stock Taking <b>{0}</b> processed.<br><br>"
                        "Normal Delivery Note <b>{1}</b> created as Draft.<br>"
                        "Return Delivery Note <b>{2}</b> created as Draft.<br><br>"
                        "Please submit the Normal Delivery Note first."
                    ).format(
                        stock_taking_name,
                        normal_dn.get("name"),
                        return_dn.get("name")
                    ),
                    "indicator": "green"
                },
                user=frappe.session.user
            )

        elif normal_dn:

            frappe.publish_realtime(
                "msgprint",
                {
                    "message": _(
                        "Stock Taking <b>{0}</b> processed.<br><br>"
                        "Normal Delivery Note <b>{1}</b> "
                        "created as Draft."
                    ).format(
                        stock_taking_name,
                        normal_dn.get("name")
                    ),
                    "indicator": "green"
                },
                user=frappe.session.user
            )

        elif return_dn:

            frappe.publish_realtime(
                "msgprint",
                {
                    "message": _(
                        "Stock Taking <b>{0}</b> processed.<br><br>"
                        "Return Delivery Note <b>{1}</b> "
                        "created as Draft.<br><br>"
                        "No normal Delivery Note was required."
                    ).format(
                        stock_taking_name,
                        return_dn.get("name")
                    ),
                    "indicator": "orange"
                },
                user=frappe.session.user
            )

        else:

            frappe.publish_realtime(
                "msgprint",
                {
                    "message": _(
                        "Stock Taking <b>{0}</b> completed. "
                        "No stock difference found."
                    ).format(
                        stock_taking_name
                    ),
                    "indicator": "green"
                },
                user=frappe.session.user
            )

    except Exception:

        frappe.log_error(
            frappe.get_traceback(),
            f"Stock Taking Processing Failed - {stock_taking_name}"
        )

        frappe.publish_realtime(
            "msgprint",
            {
                "message": _(
                    "Stock Taking <b>{0}</b> processing failed. "
                    "Please check Error Log."
                ).format(
                    stock_taking_name
                ),
                "indicator": "red"
            },
            user=frappe.session.user
        )


# =============================================================
# SCAN BARCODE
# =============================================================

@frappe.whitelist()
def scan_barcode(code, warehouses=None):

    try:

        if isinstance(warehouses, str):

            warehouses = frappe.parse_json(
                warehouses
            )

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

            serial_filters[
                "warehouse"
            ] = warehouse

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

    if isinstance(
        serials,
        str
    ):

        serials = frappe.parse_json(
            serials
        )

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
# ANALYZE STOCK TAKING
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
            ].add(
                row.name
            )

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
                    {}
                ).get(
                    "physical_count",
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
                data.get(
                    "physical_count",
                    0
                )
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

                    unique_extra_serials = list(
                        dict.fromkeys(
                            extra_serials
                        )
                    )

                    receipt_items.append({
                        "item_code": item_code,
                        "warehouse": warehouse,
                        "serial_no": "\n".join(
                            sorted(
                                unique_extra_serials
                            )
                        ),
                        "qty": len(
                            unique_extra_serials
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
# =============================================================

def get_item_delivery_rate_map(
    item_codes,
    company
):

    item_codes = list({
        item
        for item in item_codes
        if item
    })

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
# CREATE NORMAL DELIVERY NOTE
# =============================================================

@frappe.whitelist()
def create_delivery_note(doc):

    import json

    if isinstance(
        doc,
        str
    ):

        doc = json.loads(
            doc
        )

    if not doc:

        frappe.throw(
            _("Delivery Note data is required.")
        )

    # =========================================================
    # STOCK TAKING REFERENCE
    # =========================================================

    stock_taking_name = (
        doc.get("stock_taking_name")
        or doc.get("custom_stock_taking")
        or doc.get("stock_taking")
    )

    if not stock_taking_name:

        frappe.throw(
            _("Stock Taking reference is required.")
        )

    # =========================================================
    # STOCK TAKING
    # =========================================================

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
            ).format(
                company
            )
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

    # ---------------------------------------------------------
    # FALLBACK
    # ---------------------------------------------------------

    if not default_warehouse:

        for row in (
            doc.get("items") or []
        ):

            if isinstance(
                row,
                dict
            ):

                warehouse = row.get(
                    "warehouse"
                )

            else:

                warehouse = getattr(
                    row,
                    "warehouse",
                    None
                )

            if warehouse:

                default_warehouse = warehouse
                break

    if not default_warehouse:

        frappe.throw(
            _(
                "No Warehouse found in Stock Taking {0}."
            ).format(
                stock_taking_name
            )
        )

    # =========================================================
    # CREATE DELIVERY NOTE
    # =========================================================

    dn = frappe.new_doc(
        "Delivery Note"
    )

    dn.custom_stock_taking = (
        stock_taking_name
    )

    dn.company = company
    dn.customer = customer

    # Normal Delivery Note

    dn.is_return = 0
    dn.return_against = None

    dn.is_internal_customer = 0
    dn.represents_company = None

    dn.set_warehouse = (
        default_warehouse
    )

    # =========================================================
    # ADD ITEMS
    # =========================================================

    for source_item in (
        doc.get("items") or []
    ):

        if hasattr(
            source_item,
            "as_dict"
        ):

            source_item = (
                source_item.as_dict()
            )

        item = dn.append(
            "items",
            {}
        )

        if isinstance(
            source_item,
            dict
        ):

            for field in [
                "item_code",
                "item_name",
                "description",
                "qty",
                "uom",
                "stock_uom",
                "conversion_factor",
                "warehouse",
                "serial_no",
                "batch_no",
                "allow_zero_valuation_rate",
                "income_account",
                "cost_center",
                "project",
                "project_name",
            ]:

                if field in source_item:

                    value = (
                        source_item.get(
                            field
                        )
                    )

                    if value is not None:

                        item.set(
                            field,
                            value
                        )

        item.warehouse = (
            default_warehouse
        )

        if hasattr(
            item,
            "target_warehouse"
        ):

            item.target_warehouse = None

        if hasattr(
            item,
            "from_warehouse"
        ):

            item.from_warehouse = None

    # =========================================================
    # SIS CONFIGURATION
    # =========================================================

    config = frappe.db.get_value(
        "SIS Configuration",
        {
            "company": company
        },
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
            ).format(
                company
            )
        )

    fresh_margin = Decimal(
        str(
            config.fresh_margin or 0
        )
    )

    output_gst_min_net_rate = Decimal(
        str(
            config.output_gst_min_net_rate or 0
        )
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
    # MRP
    # =========================================================

    rate_map = {}

    if item_codes:

        rate_map = (
            get_item_delivery_rate_map(
                item_codes,
                company
            ) or {}
        )

    # =========================================================
    # DECIMAL HELPERS
    # =========================================================

    def D(value):

        return Decimal(
            str(value or 0)
        )

    def R2(value):

        return value.quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP
        )

    # =========================================================
    # PROCESS ITEMS
    # =========================================================

    for idx, item in enumerate(
        dn.items,
        start=1
    ):

        item.warehouse = (
            default_warehouse
        )

        if hasattr(
            item,
            "target_warehouse"
        ):

            item.target_warehouse = None

        if hasattr(
            item,
            "from_warehouse"
        ):

            item.from_warehouse = None

        qty = D(
            item.qty
        )

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

        item.rate = float(
            mrp
        )

        item.price_list_rate = float(
            mrp
        )

        # -----------------------------------------------------
        # TAXABLE
        # -----------------------------------------------------

        taxable = R2(
            mrp * qty
        )

        # -----------------------------------------------------
        # GST
        # -----------------------------------------------------

        if abs(
            taxable
        ) <= output_gst_min_net_rate:

            gst_percent = Decimal(
                "5"
            )

        else:

            gst_percent = Decimal(
                "18"
            )

        gst_value = R2(
            taxable
            * gst_percent
            / (
                Decimal("100")
                + gst_percent
            )
        )

        net_sale_value = R2(
            taxable
            - gst_value
        )

        margin_value = R2(
            taxable
            * fresh_margin
            / Decimal("100")
        )

        # -----------------------------------------------------
        # CUSTOM VALUES
        # -----------------------------------------------------

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
    # INSERT AS DRAFT
    # =========================================================

    dn.docstatus = 0

    dn.flags.ignore_permissions = True
    dn.flags.ignore_mandatory = True
    dn.flags.ignore_links = True

    try:

        dn.insert(
            ignore_permissions=True,
            ignore_mandatory=True
        )

    except Exception:

        frappe.log_error(
            frappe.get_traceback(),
            "Stock Taking - Delivery Note Creation Failed"
        )

        frappe.throw(
            _(
                "Delivery Note could not be created for "
                "Stock Taking <b>{0}</b>.<br><br>"
                "{1}"
            ).format(
                stock_taking_name,
                frappe.get_traceback()
            )
        )

    return {
        "name": dn.name,
        "doctype": "Delivery Note",
        "docstatus": dn.docstatus,
        "custom_stock_taking": (
            dn.custom_stock_taking
        )
    }


# =============================================================
# CREATE RETURN DELIVERY NOTE - DRAFT
#
# IMPORTANT:
# return_against is intentionally BLANK.
#
# It will be automatically updated after normal Delivery Note
# is submitted.
# =============================================================

@frappe.whitelist()
def create_delivery_note_return(doc):

    import json

    if isinstance(
        doc,
        str
    ):

        doc = json.loads(
            doc
        )

    if not doc:

        frappe.throw(
            _("Delivery Note data is required.")
        )

    # =========================================================
    # STOCK TAKING REFERENCE
    # =========================================================

    stock_taking_name = (
        doc.get("stock_taking_name")
        or doc.get("custom_stock_taking")
        or doc.get("stock_taking")
    )

    if not stock_taking_name:

        frappe.throw(
            _("Stock Taking reference is required.")
        )

    # =========================================================
    # STOCK TAKING
    # =========================================================

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
            ).format(
                company
            )
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

    # ---------------------------------------------------------
    # FALLBACK
    # ---------------------------------------------------------

    if not default_warehouse:

        for row in (
            doc.get("items") or []
        ):

            if isinstance(
                row,
                dict
            ):

                warehouse = row.get(
                    "warehouse"
                )

            else:

                warehouse = getattr(
                    row,
                    "warehouse",
                    None
                )

            if warehouse:

                default_warehouse = warehouse
                break

    if not default_warehouse:

        frappe.throw(
            _(
                "Warehouse is required to create "
                "Delivery Note Return."
            )
        )

    # =========================================================
    # CREATE RETURN DELIVERY NOTE
    # =========================================================

    dn = frappe.new_doc(
        "Delivery Note"
    )

    dn.custom_stock_taking = (
        stock_taking_name
    )

    dn.company = company
    dn.customer = customer

    # ---------------------------------------------------------
    # RETURN
    # ---------------------------------------------------------

    dn.is_return = 1

    # VERY IMPORTANT:
    # Keep blank initially.
    #
    # This will be updated after normal Delivery Note
    # is submitted.

    dn.return_against = None

    dn.is_internal_customer = 0
    dn.represents_company = None

    dn.set_warehouse = (
        default_warehouse
    )

    # =========================================================
    # ITEMS
    # =========================================================

    source_items = (
        doc.get("items") or []
    )

    if not source_items:

        frappe.throw(
            _(
                "No items found for Return Delivery Note "
                "for Stock Taking {0}."
            ).format(
                stock_taking_name
            )
        )

    for source_item in source_items:

        if hasattr(
            source_item,
            "as_dict"
        ):

            source_item = (
                source_item.as_dict()
            )

        item = dn.append(
            "items",
            {}
        )

        if isinstance(
            source_item,
            dict
        ):

            for field in [
                "item_code",
                "item_name",
                "description",
                "qty",
                "uom",
                "stock_uom",
                "conversion_factor",
                "warehouse",
                "serial_no",
                "batch_no",
                "allow_zero_valuation_rate",
                "income_account",
                "cost_center",
                "project",
                "project_name",
            ]:

                if field in source_item:

                    value = (
                        source_item.get(
                            field
                        )
                    )

                    if value is not None:

                        item.set(
                            field,
                            value
                        )

        item.warehouse = (
            item.warehouse
            or default_warehouse
        )

        if hasattr(
            item,
            "target_warehouse"
        ):

            item.target_warehouse = None

        if hasattr(
            item,
            "from_warehouse"
        ):

            item.from_warehouse = None

    # =========================================================
    # SIS CONFIGURATION
    # =========================================================

    config = frappe.db.get_value(
        "SIS Configuration",
        {
            "company": company
        },
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
            ).format(
                company
            )
        )

    fresh_margin = Decimal(
        str(
            config.fresh_margin or 0
        )
    )

    output_gst_min_net_rate = Decimal(
        str(
            config.output_gst_min_net_rate or 0
        )
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
    # MRP
    # =========================================================

    rate_map = {}

    if item_codes:

        rate_map = (
            get_item_delivery_rate_map(
                item_codes,
                company
            ) or {}
        )

    # =========================================================
    # DECIMAL HELPERS
    # =========================================================

    def D(value):

        return Decimal(
            str(value or 0)
        )

    def R2(value):

        return value.quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP
        )

    # =========================================================
    # PROCESS ITEMS
    # =========================================================

    for idx, item in enumerate(
        dn.items,
        start=1
    ):

        item.warehouse = (
            item.warehouse
            or default_warehouse
        )

        if hasattr(
            item,
            "target_warehouse"
        ):

            item.target_warehouse = None

        if hasattr(
            item,
            "from_warehouse"
        ):

            item.from_warehouse = None

        # -----------------------------------------------------
        # QUANTITY
        # -----------------------------------------------------

        qty = D(
            item.qty
        )

        # Return quantity must be negative

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

        item.qty = float(
            qty
        )

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

        item.rate = float(
            mrp
        )

        item.price_list_rate = float(
            mrp
        )

        # -----------------------------------------------------
        # TAXABLE
        # -----------------------------------------------------

        taxable = R2(
            mrp * qty
        )

        # -----------------------------------------------------
        # GST
        # -----------------------------------------------------

        if abs(
            taxable
        ) <= output_gst_min_net_rate:

            gst_percent = Decimal(
                "5"
            )

        else:

            gst_percent = Decimal(
                "18"
            )

        gst_value = R2(
            taxable
            * gst_percent
            / (
                Decimal("100")
                + gst_percent
            )
        )

        net_sale_value = R2(
            taxable
            - gst_value
        )

        margin_value = R2(
            taxable
            * fresh_margin
            / Decimal("100")
        )

        # -----------------------------------------------------
        # CUSTOM VALUES
        # -----------------------------------------------------

        item.amount = float(
            taxable
        )

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
    # INSERT AS DRAFT
    # =========================================================

    dn.docstatus = 0

    dn.flags.ignore_permissions = True
    dn.flags.ignore_mandatory = True
    dn.flags.ignore_links = True

    try:

        dn.insert(
            ignore_permissions=True,
            ignore_mandatory=True
        )

    except Exception:

        frappe.log_error(
            frappe.get_traceback(),
            "Stock Taking - Return Delivery Note Creation Failed"
        )

        frappe.throw(
            _(
                "Return Delivery Note could not be created "
                "for Stock Taking <b>{0}</b>.<br><br>{1}"
            ).format(
                stock_taking_name,
                frappe.get_traceback()
            )
        )

    # =========================================================
    # RESPONSE
    # =========================================================

    return {
        "name": dn.name,
        "doctype": "Delivery Note",
        "docstatus": dn.docstatus,
        "is_return": dn.is_return,

        # Blank initially.
        # Will be updated after normal DN submit.
        "return_against": dn.return_against,

        "customer": dn.customer,
        "company": dn.company,
        "set_warehouse": dn.set_warehouse,
        "custom_stock_taking": (
            dn.custom_stock_taking
        )
    }


# =============================================================
# AUTO LINK RETURN DN AFTER NORMAL DN SUBMIT
# =============================================================

def link_return_delivery_note(doc, method=None):

    try:

        # =====================================================
        # ONLY NORMAL DELIVERY NOTE
        # =====================================================

        if doc.doctype != "Delivery Note":
            return

        if doc.docstatus != 1:
            return

        if doc.is_return:
            return

        stock_taking_name = (
            doc.get("custom_stock_taking")
        )

        if not stock_taking_name:
            return

        # =====================================================
        # FIND DRAFT RETURN DELIVERY NOTE
        # =====================================================

        return_dn_name = frappe.db.get_value(
            "Delivery Note",
            {
                "custom_stock_taking": stock_taking_name,
                "is_return": 1,
                "docstatus": 0
            },
            "name",
            order_by="creation desc"
        )

        if not return_dn_name:
            return

        # =====================================================
        # UPDATE RETURN AGAINST
        # =====================================================

        frappe.db.set_value(
            "Delivery Note",
            return_dn_name,
            "return_against",
            doc.name,
            update_modified=True
        )

        # =====================================================
        # CLEAR CACHE
        # =====================================================

        frappe.clear_document_cache(
            "Delivery Note",
            return_dn_name
        )

        # =====================================================
        # MESSAGE
        # =====================================================

        frappe.msgprint(
            _(
                "Return Delivery Note "
                "<b>{0}</b> has been linked against "
                "submitted Delivery Note <b>{1}</b>."
            ).format(
                return_dn_name,
                doc.name
            ),
            indicator="green"
        )

    except Exception:

        frappe.log_error(
            frappe.get_traceback(),
            "Stock Taking - Link Return Delivery Note Failed"
        )

        # Don't block normal Delivery Note submission
        # because of linking issue.