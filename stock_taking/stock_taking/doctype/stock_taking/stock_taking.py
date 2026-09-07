# Copyright (c) 2025, bhumika.d@stackerbee.com and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document

class StockTaking(Document):

    def before_cancel(self):
        # =========================================================
        # STOCK ENTRIES
        # =========================================================
        stock_entries = frappe.get_all(
            "Stock Entry",
            filters={"custom_stock_taking": self.name},
            fields=["name", "docstatus"]
        )

        for se in stock_entries:

            # Submitted Stock Entry → Stop Cancellation
            if se.docstatus == 1:
                frappe.throw(
                    _("Cannot cancel Stock Taking because Stock Entry <b>{0}</b> is Submitted. Please cancel it first.")
                    .format(se.name)
                )

            # Draft Stock Entry → Delete
            elif se.docstatus == 0:
                doc = frappe.get_doc("Stock Entry", se.name)
                doc.flags.ignore_permissions = True
                doc.delete()


        # =========================================================
        # DELIVERY NOTES
        # =========================================================
        delivery_notes = frappe.get_all(
            "Delivery Note",
            filters={"custom_stock_taking": self.name},
            fields=["name", "docstatus"]
        )

        for dn in delivery_notes:

            # Submitted Delivery Note → Stop Cancellation
            if dn.docstatus == 1:
                frappe.throw(
                    _("Cannot cancel Stock Taking because Delivery Note <b>{0}</b> is Submitted. Please cancel it first.")
                    .format(dn.name)
                )

            # Draft Delivery Note → Delete
            elif dn.docstatus == 0:
                doc = frappe.get_doc("Delivery Note", dn.name)
                doc.flags.ignore_permissions = True
                doc.delete()


        frappe.db.commit()
# @frappe.whitelist()
# def scan_barcode(code, warehouses=None):
#     try:
#         if frappe.db.exists("Serial No", code):
#             serial = frappe.get_doc("Serial No", code)
#             return {
#                 "success": True,
#                 "type": "serial",
#                 "result": {
#                     "name": serial.name,
#                     "item_code": serial.item_code,
#                     "warehouse": serial.warehouse,
#                     "status": serial.status
#                 }
#             }

#         if isinstance(warehouses, str):
#             warehouses = frappe.parse_json(warehouses)

#         bins = frappe.get_all(
#             "Bin",
#             fields=["item_code", "warehouse", "actual_qty"],
#             filters={
#                 "item_code": code,
#                 "warehouse": ["in", warehouses or []]
#             },
#             limit_page_length=50
#         )

#         if bins:
#             return {
#                 "success": True,
#                 "type": "item",
#                 "result": bins
#             }

#         return {
#             "success": False,
#             "message": "No Serial or Item found"
#         }

#     except Exception:
#         frappe.log_error(frappe.get_traceback(), "scan_barcode error")
#         return {
#             "success": False,
#             "message": "Scan failed"
#         }


# @frappe.whitelist()
# def scan_barcode(code, warehouses=None):
#     try:
#         if isinstance(warehouses, str):
#             warehouses = frappe.parse_json(warehouses)

#         # ===============================
#         # 🔹 SERIAL SCAN
#         # ===============================
#         if frappe.db.exists("Serial No", code):
#             serial = frappe.get_doc("Serial No", code)

#             return {
#                 "success": True,
#                 "type": "serial",
#                 "result": {
#                     "name": serial.name,
#                     "item_code": serial.item_code,
#                     "warehouse": serial.warehouse,
#                     "status": serial.status
#                 }
#             }

#         # ===============================
#         # 🔹 ITEM SCAN → BIN DATA
#         # ===============================
#         bin_filters = {
#             "item_code": code
#         }

#         if warehouses:
#             bin_filters["warehouse"] = ["in", warehouses]

#         bins = frappe.get_all(
#             "Bin",
#             fields=["item_code", "warehouse", "actual_qty"],
#             filters=bin_filters
#         )

#         if bins:

#             # ===============================
#             # 🔥 GET ACTIVE SERIALS (FIXED)
#             # ===============================
#             serial_filters = {
#                 "item_code": code,
#                 "status": "Active"
#             }

#             if warehouses:
#                 serial_filters["warehouse"] = ["in", warehouses]

#             serials = frappe.get_all(
#                 "Serial No",
#                 fields=["name"],
#                 filters=serial_filters
#             )

#             return {
#                 "success": True,
#                 "type": "item",
#                 "result": bins,
#                 "serials": [s.name for s in serials]
#             }

#         return {
#             "success": False,
#             "message": "No Serial or Item found"
#         }

#     except Exception:
#         frappe.log_error(frappe.get_traceback(), "scan_barcode error")
#         return {
#             "success": False,
#             "message": "Scan failed"
#         }

@frappe.whitelist()
def scan_barcode(code, warehouses=None):

    try:

        if isinstance(warehouses, str):
            warehouses = frappe.parse_json(warehouses)

        warehouses = warehouses or []

        # =====================================
        # 🔹 SERIAL SCAN
        # =====================================
        if frappe.db.exists("Serial No", code):

            serial = frappe.get_doc("Serial No", code)

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

        # =====================================
        # 🔹 ITEM BARCODE
        # =====================================
        item_code = frappe.db.get_value(
            "Item Barcode",
            {"barcode": code},
            "parent"
        )

        # =====================================
        # 🔹 DIRECT ITEM CODE
        # =====================================
        if not item_code:

            if frappe.db.exists("Item", code):
                item_code = code

        # =====================================
        # ❌ ITEM NOT FOUND
        # =====================================
        if not item_code:

            return {
                "success": False,
                "message": "No Serial or Item found"
            }

        # =====================================
        # 🔹 SELECTED WAREHOUSE
        # =====================================
        warehouse = warehouses[0] if warehouses else ""

        # =====================================
        # 🔹 GET BIN QTY
        # =====================================
        actual_qty = frappe.db.get_value(
            "Bin",
            {
                "item_code": item_code,
                "warehouse": warehouse
            },
            "actual_qty"
        ) or 0

        # =====================================
        # 🔥 GET ACTIVE SERIALS
        # =====================================
        serial_filters = {
            "item_code": item_code,
            "status": "Active"
        }

        if warehouse:
            serial_filters["warehouse"] = warehouse

        serials = frappe.get_all(
            "Serial No",
            fields=["name"],
            filters=serial_filters
        )

        # =====================================
        # ✅ ALWAYS RETURN ITEM
        # EVEN IF STOCK = 0
        # =====================================
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
            "serials": [s.name for s in serials]
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

@frappe.whitelist()
def get_system_serials(item_code, warehouse):
    return frappe.get_all(
        "Serial No",
        pluck="name",
        filters={
            "item_code": item_code,
            "warehouse": warehouse,
            "status": "Active"
        }
    )


@frappe.whitelist()
def make_serial_active(serials):
    for s in serials:
        frappe.db.set_value("Serial No", s, {
            "status": "Active"
        })

@frappe.whitelist()
def get_warehouse_serials(warehouse):

    return frappe.db.sql("""
        SELECT
            name as serial_no,
            item_code
        FROM `tabSerial No`
        WHERE warehouse = %s
        AND status = 'Active'
    """, warehouse, as_dict=1)


@frappe.whitelist()
def get_non_serialized_stock(warehouse):

    data = frappe.db.sql("""

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

    """, (warehouse,), as_dict=1)

    return data



# @frappe.whitelist()
# def create_stock_entry(doc):

#     import json

#     if isinstance(doc, str):
#         doc = json.loads(doc)

#     se = frappe.get_doc(doc)

#     se.insert(ignore_permissions=True)

#     frappe.db.commit()

#     return se



import frappe
from frappe.model.document import Document
from frappe.utils import flt

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
    # PARSE DOC
    # =========================================================

    if isinstance(doc, str):
        doc = json.loads(doc)

    if not doc:
        frappe.throw(
            "Delivery Note data is required."
        )

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
    # STOCK TAKING NAME
    # =========================================================

    stock_taking_name = (
        doc.get("custom_stock_taking")
        or doc.get("stock_taking")
    )

    if not stock_taking_name:
        frappe.throw(
            "Stock Taking reference is required."
        )

    # =========================================================
    # GET STOCK TAKING DOCUMENT
    # =========================================================

    stock_taking = frappe.get_doc(
        "Stock Taking",
        stock_taking_name
    )

    # =========================================================
    # VALIDATE COMPANY
    # =========================================================

    if not stock_taking.company:
        frappe.throw(
            "Company is required in Stock Taking."
        )

    stock_taking_company = stock_taking.company

    # =========================================================
    # GET CUSTOMER FROM STOCK TAKING SETTINGS
    # =========================================================

    settings = frappe.get_doc(
        "Stock Taking Settings",
        "Stock Taking Settings"
    )

    customer = None

    for row in settings.stock_taking_customer:

        if row.company == stock_taking_company:
            customer = row.customer
            break

    # =========================================================
    # VALIDATE CUSTOMER
    # =========================================================

    if not customer:
        frappe.throw(
            f"Please add Company <b>{stock_taking_company}</b> "
            "and its Customer in Stock Taking Settings."
        )

    # =========================================================
    # CREATE DELIVERY NOTE DOCUMENT
    # =========================================================

    dn = frappe.get_doc(doc)

    # =========================================================
    # SET COMPANY
    # =========================================================

    dn.company = stock_taking_company

    # =========================================================
    # SET CUSTOMER
    # =========================================================

    dn.customer = customer

    # =========================================================
    # SET STOCK TAKING REFERENCE
    # =========================================================

    if hasattr(dn, "custom_stock_taking"):
        dn.custom_stock_taking = stock_taking_name

    # =========================================================
    # NORMAL OUTWARD DELIVERY NOTE
    # =========================================================

    dn.is_return = 0
    dn.return_against = None

    dn.is_internal_customer = 0
    dn.represents_company = None

    # =========================================================
    # GET WAREHOUSE FROM STOCK TAKING
    # =========================================================

    stock_taking_warehouses = frappe.db.get_all(
        "stock taking Warehouse",
        filters={
            "parent": stock_taking_name,
            "parenttype": "Stock Taking",
            "parentfield": "warehouse"
        },
        fields=[
            "warehuose",
            "idx"
        ],
        order_by="idx asc"
    )

    if not stock_taking_warehouses:
        frappe.throw(
            f"No Warehouse found in Stock Taking "
            f"{stock_taking_name}."
        )

    default_warehouse = (
        stock_taking_warehouses[0].get("warehuose")
    )

    if not default_warehouse:
        frappe.throw(
            f"Warehouse is empty in Stock Taking "
            f"{stock_taking_name}."
        )

    # =========================================================
    # SET DELIVERY NOTE WAREHOUSE
    # =========================================================

    dn.set_warehouse = default_warehouse

    # =========================================================
    # REMOVE INTERNAL TRANSFER FIELDS
    # =========================================================

    for item in dn.items:

        if hasattr(item, "target_warehouse"):
            item.target_warehouse = None

        if hasattr(item, "from_warehouse"):
            item.from_warehouse = None

        item.warehouse = default_warehouse

    # =========================================================
    # SIS CONFIGURATION
    # =========================================================

    config = frappe.db.get_value(
        "SIS Configuration",
        {
            "company": dn.company
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
            f"SIS Configuration not found for Company: "
            f"{dn.company}"
        )

    # =========================================================
    # CONFIG VALUES
    # =========================================================

    fresh_margin = D(
        config.fresh_margin
    )

    discounted_margin = D(
        config.discounted_margin
    )

    output_gst_min_net_rate = D(
        config.output_gst_min_net_rate
    )

    # =========================================================
    # CALCULATE ITEMS
    # =========================================================

    for item in dn.items:

        # -----------------------------------------------------
        # SET WAREHOUSE
        # -----------------------------------------------------

        item.warehouse = default_warehouse

        # -----------------------------------------------------
        # QUANTITY
        # -----------------------------------------------------

        qty = D(
            item.qty
        )

        if qty <= 0:
            continue

        # =====================================================
        # GET ITEM MRP
        # =====================================================

        rate_data = get_item_delivery_rate(
            item.item_code,
            dn.company
        )

        if not rate_data:
            frappe.throw(
                f"MRP not found for Item "
                f"<b>{item.item_code}</b> "
                f"in submitted Purchase Receipt "
                f"for Company <b>{dn.company}</b>."
            )

        # IMPORTANT:
        # Keep MRP as Decimal because qty is also Decimal
        mrp = D(
            rate_data.get("mrp") or 0
        )

        if mrp <= 0:
            frappe.throw(
                f"MRP is zero for Item "
                f"<b>{item.item_code}</b>."
            )

        # Delivery Note fields accept numeric/float value
        item.rate = float(mrp)
        item.price_list_rate = float(mrp)

        # =====================================================
        # TAXABLE AMOUNT
        # =====================================================

        taxable_amount_value = R2(
            mrp * qty
        )

        # =====================================================
        # OUTPUT GST %
        # =====================================================

        if (
            abs(taxable_amount_value)
            <= output_gst_min_net_rate
        ):
            output_gst_percent = D(5)

        else:
            output_gst_percent = D(18)

        # =====================================================
        # OUTPUT GST VALUE
        # =====================================================

        output_gst_value = R2(
            taxable_amount_value
            * output_gst_percent
            / (
                D(100)
                + output_gst_percent
            )
        )

        # =====================================================
        # NET SALE VALUE
        # =====================================================

        net_sale_value = R2(
            taxable_amount_value
            - output_gst_value
        )

        # =====================================================
        # MARGIN
        # =====================================================

        margin_percent = fresh_margin

        margin_value = R2(
            taxable_amount_value
            * margin_percent
            / D(100)
        )

        # =====================================================
        # TOTAL INVOICE AMOUNT
        # =====================================================

        total_invoice_amount = R2(
            taxable_amount_value
        )

        # =====================================================
        # SET CUSTOM FIELDS
        # =====================================================

        item.custom_output_gst_ = float(
            output_gst_percent
        )

        item.custom_output_gst_value = float(
            output_gst_value
        )

        item.custom_net_sale_value = float(
            net_sale_value
        )

        item.custom_margin_amount = float(
            margin_value
        )

        item.custom_margins_ = float(
            margin_percent
        )

        item.custom_total_invoice_amount = float(
            total_invoice_amount
        )

        # =====================================================
        # LOG ITEM RATE
        # =====================================================

        frappe.logger().info(
            f"""
STOCK TAKING DELIVERY NOTE ITEM
================================
Stock Taking : {stock_taking_name}
Item         : {item.item_code}
Qty          : {qty}
MRP          : {mrp}
Rate         : {item.rate}
Warehouse    : {item.warehouse}
"""
        )

    # =========================================================
    # FINAL FORCE
    # =========================================================

    dn.is_return = 0
    dn.return_against = None

    dn.is_internal_customer = 0
    dn.represents_company = None

    # =========================================================
    # FINAL ITEM VALUES
    # =========================================================

    for item in dn.items:

        item.warehouse = default_warehouse

        if hasattr(item, "target_warehouse"):
            item.target_warehouse = None

        if hasattr(item, "from_warehouse"):
            item.from_warehouse = None

    # =========================================================
    # VALIDATE SET WAREHOUSE
    # =========================================================

    if not dn.set_warehouse:
        frappe.throw(
            "Delivery Note Set Warehouse is missing."
        )

    # =========================================================
    # VALIDATE ITEM WAREHOUSE
    # =========================================================

    for idx, item in enumerate(
        dn.items,
        start=1
    ):

        if not item.warehouse:

            frappe.throw(
                f"Row {idx}: Warehouse is missing "
                f"for Item {item.item_code}"
            )

        item.warehouse = default_warehouse

    # =========================================================
    # FINAL LOG
    # =========================================================

    frappe.logger().info(
        f"""
FINAL DELIVERY NOTE
===================
Stock Taking  : {stock_taking_name}
Company       : {dn.company}
Customer      : {dn.customer}
Set Warehouse : {dn.set_warehouse}
Internal      : {dn.is_internal_customer}
Represents    : {dn.represents_company}
Is Return     : {dn.is_return}
Warehouse     : {default_warehouse}
Items         : {len(dn.items)}
Docstatus     : {dn.docstatus}
"""
    )

    # =========================================================
    # INSERT AS DRAFT
    # =========================================================
    #
    # IMPORTANT:
    # Delivery Note will remain Draft.
    # User will manually review and submit.
    #
    # =========================================================

    dn.flags.ignore_permissions = True

    dn.insert(
        ignore_permissions=True
    )

    frappe.db.commit()

    # =========================================================
    # RETURN
    # =========================================================

    return {
        "name": dn.name,
        "doctype": "Delivery Note",
        "docstatus": dn.docstatus
    }
# =============================================================
# GET ITEM DELIVERY RATE
# =============================================================

# def get_item_delivery_rate(
#     item_code,
#     company
# ):

#     from decimal import Decimal

#     # =========================================================
#     # GET LATEST PURCHASE RECEIPT RATE
#     # =========================================================

#     pri = frappe.db.sql(
#         """
#         SELECT
#             pri.custom_single_item_rate AS single_item_rate,
#             pri.base_price_list_rate AS base_price_list_rate

#         FROM `tabPurchase Receipt Item` pri

#         JOIN `tabPurchase Receipt` pr
#             ON pr.name = pri.parent

#         WHERE
#             pri.item_code = %s
#             AND pr.company = %s
#             AND pr.docstatus = 1

#         ORDER BY
#             pr.posting_date DESC,
#             pr.posting_time DESC,
#             pri.creation DESC

#         LIMIT 1
#         """,
#         (
#             item_code,
#             company
#         ),
#         as_dict=True
#     )

#     # =========================================================
#     # NO PURCHASE RATE FOUND
#     # =========================================================

#     if not pri:

#         return (
#             Decimal("0"),
#             Decimal("0")
#         )

#     row = pri[0]

#     # =========================================================
#     # SINGLE ITEM RATE
#     # =========================================================

#     single_item_rate = abs(
#         Decimal(
#             str(
#                 row.single_item_rate or 0
#             )
#         )
#     )

#     # =========================================================
#     # BASE PRICE LIST RATE
#     # =========================================================

#     base_price_list_rate = abs(
#         Decimal(
#             str(
#                 row.base_price_list_rate or 0
#             )
#         )
#     )

#     # =========================================================
#     # RETURN
#     # =========================================================

#     return (
#         single_item_rate,
#         base_price_list_rate
#     )


# @frappe.whitelist()
# def create_stock_entry(doc):

#     import json
#     from decimal import Decimal

#     if isinstance(doc, str):
#         doc = json.loads(doc)

#     def D(value):
#         return Decimal(
#             str(value or 0)
#         )

#     def R2(value):
#         return value.quantize(
#             Decimal("0.01")
#         )

#     # =========================================================
#     # CREATE STOCK ENTRY
#     # =========================================================

#     se = frappe.get_doc(doc)

#     se.insert(
#         ignore_permissions=True
#     )

#     # =========================================================
#     # SIS CONFIGURATION
#     # =========================================================

#     config = frappe.db.get_value(
#         "SIS Configuration",
#         {
#             "company": se.company
#         },
#         [
#             "fresh_margin",
#             "discounted_margin",
#             "output_gst_min_net_rate",
#             "input_gst_for_opening_stock",
#             "auto_credit_note_percent",
#             "discount_threshold"
#         ],
#         as_dict=True
#     )

#     if not config:
#         frappe.throw(
#             f"SIS Configuration not found for Company: {se.company}"
#         )

#     fresh_margin = D(
#         config.fresh_margin
#     )

#     discounted_margin = D(
#         config.discounted_margin
#     )

#     output_gst_min_net_rate = D(
#         config.output_gst_min_net_rate
#     )

#     input_gst_for_opening_stock = D(
#         config.input_gst_for_opening_stock
#     )

#     # =========================================================
#     # CALCULATE EACH ITEM
#     # =========================================================

#     for item in se.items:

#         qty = D(item.qty)

#         # =====================================================
#         # INPUT GST + RATE
#         # =====================================================

#         (
#             st_percent,
#             input_gst_value,
#             single_item_rate,
#             base_price_list_rate
#         ) = get_item_input_gst(
#             item.item_code,
#             se.company
#         )

#         st_percent = D(
#             st_percent
#         )

#         input_gst_value = D(
#             input_gst_value
#         )

#         base_price_list_rate = D(
#             base_price_list_rate
#         )

#         single_item_rate = D(
#             single_item_rate
#         )

#         # =====================================================
#         # TAXABLE AMOUNT
#         # =====================================================

#         taxable_amount_value = R2(
#             base_price_list_rate
#             *
#             qty
#         )

#         # =====================================================
#         # OUTPUT GST %
#         # =====================================================

#         if (
#             abs(taxable_amount_value)
#             <= output_gst_min_net_rate
#         ):
#             output_gst_percent = D(5)
#         else:
#             output_gst_percent = D(18)

#         # =====================================================
#         # OUTPUT GST VALUE
#         # =====================================================

#         output_gst_value = R2(
#             taxable_amount_value
#             *
#             output_gst_percent
#             /
#             (
#                 D(100)
#                 +
#                 output_gst_percent
#             )
#         )

#         # =====================================================
#         # NET SALE VALUE
#         # =====================================================

#         net_sale_value = R2(
#             taxable_amount_value
#             -
#             output_gst_value
#         )

#         # =====================================================
#         # MARGIN %
#         # =====================================================

#         margin_percent = fresh_margin

#         # =====================================================
#         # MARGIN VALUE
#         # =====================================================

#         margin_value = R2(
#             taxable_amount_value
#             *
#             margin_percent
#             /
#             D(100)
#         )

#         # =====================================================
#         # INV BASE VALUE
#         # =====================================================

#         inv_base_value = R2(
#             net_sale_value
#             -
#             margin_value
#         )

#         # =====================================================
#         # INPUT GST 0 CASE
#         # =====================================================

#         if input_gst_value == 0:

#             if (
#                 abs(inv_base_value)
#                 <= input_gst_for_opening_stock
#             ):
#                 st_percent = D(5)
#             else:
#                 st_percent = D(18)

#             input_gst_value = R2(
#                 inv_base_value
#                 *
#                 st_percent
#                 /
#                 D(100)
#             )

#         # =====================================================
#         # COLLECTABLE
#         # =====================================================

#         custom_collectable = R2(
#             inv_base_value
#             +
#             input_gst_value
#         )

#         # =====================================================
#         # SET CUSTOM FIELDS
#         # =====================================================

#         item.custom_output_gst = float(
#             output_gst_percent
#         )

#         item.custom_taxable_amount_value = float(
#             taxable_amount_value
#         )

#         item.custom_output_gst_value = float(
#             output_gst_value
#         )

#         item.custom_margin = float(
#             margin_percent
#         )

#         item.custom_margin_value = float(
#             margin_value
#         )

#         item.custom_inv_base_value = float(
#             inv_base_value
#         )

#         item.custom_input_gst_value = float(
#             input_gst_value * qty
#         )

#         item.custom_collectable = float(
#             inv_base_value
#             +
#             (
#                 input_gst_value
#                 *
#                 qty
#             )
#         )

#         # =====================================================
#         # DEBUG
#         # =====================================================

#         frappe.logger().info(
#             f"""
# STOCK ENTRY ITEM: {item.item_code}
# QTY: {qty}
# BASE PRICE LIST RATE: {base_price_list_rate}
# TAXABLE: {taxable_amount_value}
# OUTPUT GST %: {output_gst_percent}
# OUTPUT GST VALUE: {output_gst_value}
# MARGIN %: {margin_percent}
# MARGIN VALUE: {margin_value}
# INV BASE: {inv_base_value}
# INPUT GST %: {st_percent}
# INPUT GST VALUE: {input_gst_value}
# SINGLE ITEM RATE: {single_item_rate}
# COLLECTABLE: {custom_collectable}
# """
#         )

#     # =========================================================
#     # SAVE
#     # =========================================================

#     se.save(
#         ignore_permissions=True
#     )

#     frappe.db.commit()

#     return se


# =============================================================
# GET ITEM INPUT GST
#
# MATERIAL RECEIPT ONLY
# =============================================================

def get_item_input_gst(
    item_code,
    company
):

    from decimal import Decimal

    pri = frappe.db.sql(
        """
        SELECT
            pri.custom_single_item_rate AS single_item_rate,
            pri.custom_single_item_input_gst_amount AS gst_amount,
            pri.base_price_list_rate AS base_price_list_rate

        FROM `tabPurchase Receipt Item` pri

        JOIN `tabPurchase Receipt` pr
            ON pr.name = pri.parent

        WHERE
            pri.item_code = %s
            AND pr.company = %s
            AND pr.docstatus = 1

        ORDER BY
            pr.posting_date DESC,
            pr.posting_time DESC,
            pri.creation DESC

        LIMIT 1
        """,
        (
            item_code,
            company
        ),
        as_dict=True
    )

    if not pri:

        return (
            Decimal("0"),
            Decimal("0"),
            Decimal("0"),
            Decimal("0")
        )

    row = pri[0]

    single_item_rate = abs(
        Decimal(
            str(
                row.single_item_rate or 0
            )
        )
    )

    gst_amount_per_item = abs(
        Decimal(
            str(
                row.gst_amount or 0
            )
        )
    )

    base_price_list_rate = abs(
        Decimal(
            str(
                row.base_price_list_rate or 0
            )
        )
    )

    gst_percent = (

        abs(
            (
                gst_amount_per_item
                *
                Decimal("100")
            )
            /
            single_item_rate
        )

        if single_item_rate > 0

        else Decimal("0")
    )

    return (
        gst_percent,
        gst_amount_per_item,
        single_item_rate,
        base_price_list_rate
    )
    
from frappe.utils import flt

def get_item_delivery_rate(item_code, company):

    result = frappe.db.sql(
        """
        SELECT
            pri.base_price_list_rate AS mrp
        FROM `tabPurchase Receipt Item` pri
        INNER JOIN `tabPurchase Receipt` pr
            ON pr.name = pri.parent
        WHERE
            pri.item_code = %s
            AND pr.company = %s
            AND pr.docstatus = 1
            AND IFNULL(pri.base_price_list_rate, 0) > 0
        ORDER BY
            pr.posting_date DESC,
            pr.posting_time DESC,
            pr.creation DESC
        LIMIT 1
        """,
        (item_code, company),
        as_dict=True
    )

    return result[0] if result else None


@frappe.whitelist()
def create_delivery_note_return(doc):
    """
    Create a Draft Delivery Note Return for Extra Stock
    found during Stock Taking.

    Stock Taking
        ↓
    Extra Stock
        ↓
    Delivery Note Return
        ↓
    Manual Submit
        ↓
    Stock IN
    """

    import json
    from decimal import Decimal, ROUND_HALF_UP

    # =========================================================
    # PARSE DOC
    # =========================================================

    if isinstance(doc, str):
        doc = json.loads(doc)

    if not doc:
        frappe.throw(
            _("Delivery Note data is required.")
        )

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
    # STOCK TAKING NAME
    # =========================================================

    stock_taking_name = (
        doc.get("custom_stock_taking")
        or doc.get("stock_taking")
    )

    if not stock_taking_name:
        frappe.throw(
            _("Stock Taking reference is required.")
        )

    # =========================================================
    # GET STOCK TAKING
    # =========================================================

    stock_taking = frappe.get_doc(
        "Stock Taking",
        stock_taking_name
    )

    # =========================================================
    # VALIDATE COMPANY
    # =========================================================

    if not stock_taking.company:
        frappe.throw(
            _("Company is required in Stock Taking.")
        )

    stock_taking_company = stock_taking.company

    # =========================================================
    # GET CUSTOMER FROM STOCK TAKING SETTINGS
    # =========================================================

    settings = frappe.get_doc(
        "Stock Taking Settings",
        "Stock Taking Settings"
    )

    customer = None

    for row in settings.get("stock_taking_customer") or []:

        if row.company == stock_taking_company:
            customer = row.customer
            break

    # =========================================================
    # VALIDATE CUSTOMER
    # =========================================================

    if not customer:
        frappe.throw(
            _(
                "Customer is not configured in Stock Taking Settings "
                "for company <b>{0}</b>."
            ).format(stock_taking_company)
        )

    # =========================================================
    # CREATE DELIVERY NOTE DOCUMENT
    # =========================================================

    dn = frappe.get_doc(doc)

    # =========================================================
    # COMPANY
    # =========================================================

    dn.company = stock_taking_company

    # =========================================================
    # CUSTOMER
    # =========================================================

    dn.customer = customer

    # =========================================================
    # STOCK TAKING REFERENCE
    # =========================================================

    if hasattr(dn, "custom_stock_taking"):
        dn.custom_stock_taking = stock_taking_name

    # =========================================================
    # RETURN DELIVERY NOTE
    # =========================================================

    dn.is_return = 1

    # No original Delivery Note against this return.
    # Return is generated directly from Stock Taking.

    dn.return_against = None

    # =========================================================
    # NORMAL CUSTOMER
    # =========================================================

    dn.is_internal_customer = 0
    dn.represents_company = None

    # =========================================================
    # GET WAREHOUSE FROM STOCK TAKING
    # =========================================================

    stock_taking_warehouses = frappe.get_all(
        "stock taking Warehouse",
        filters={
            "parent": stock_taking_name,
            "parenttype": "Stock Taking",
            "parentfield": "warehouse",
        },
        fields=[
            "warehuose",
            "idx"
        ],
        order_by="idx asc",
    )

    default_warehouse = None

    if stock_taking_warehouses:

        default_warehouse = (
            stock_taking_warehouses[0].get("warehuose")
        )

    # =========================================================
    # FALLBACK WAREHOUSE FROM STOCK TAKING ITEMS
    # =========================================================

    if not default_warehouse:

        for row in stock_taking.items:

            if row.warehouse:
                default_warehouse = row.warehouse
                break

    # =========================================================
    # VALIDATE WAREHOUSE
    # =========================================================

    if not default_warehouse:

        frappe.throw(
            _(
                "Warehouse is required to create "
                "Delivery Note Return."
            )
        )

    # =========================================================
    # SET DELIVERY NOTE WAREHOUSE
    # =========================================================

    dn.set_warehouse = default_warehouse

    # =========================================================
    # SIS CONFIGURATION
    # =========================================================

    config = frappe.db.get_value(
        "SIS Configuration",
        {
            "company": dn.company
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
                "SIS Configuration not found for Company: {0}"
            ).format(dn.company)
        )

    # =========================================================
    # CONFIG VALUES
    # =========================================================

    fresh_margin = D(
        config.fresh_margin
    )

    discounted_margin = D(
        config.discounted_margin
    )

    output_gst_min_net_rate = D(
        config.output_gst_min_net_rate
    )

    # =========================================================
    # PROCESS ITEMS
    # =========================================================

    for item in dn.items:

        item.target_warehouse = None
        item.from_warehouse = None

        if not item.warehouse:
            item.warehouse = default_warehouse

        # =====================================================
        # GET MRP
        # =====================================================

        rate_data = get_item_delivery_rate(
            item.item_code,
            dn.company
        )

        if not rate_data:
            frappe.throw(
                f"MRP not found for Item "
                f"<b>{item.item_code}</b> "
                f"in submitted Purchase Receipt "
                f"for Company <b>{dn.company}</b>."
            )

        mrp = D(
            rate_data.get("mrp") or 0
        )

        if mrp <= 0:
            frappe.throw(
                f"MRP is zero for Item "
                f"<b>{item.item_code}</b>."
            )

        # =====================================================
        # RETURN QTY MUST BE NEGATIVE
        # =====================================================

        qty = D(item.qty)

        if qty > 0:
            qty = -qty

        item.qty = float(qty)

        # =====================================================
        # RATE / MRP
        # =====================================================

        item.rate = float(mrp)
        item.price_list_rate = float(mrp)

        # =====================================================
        # AMOUNT
        # =====================================================

        amount = R2(
            mrp * qty
        )

        item.amount = float(amount)

        # =====================================================
        # TAXABLE AMOUNT
        # =====================================================

        taxable_amount_value = R2(
            mrp * qty
        )

        # =====================================================
        # OUTPUT GST %
        # =====================================================

        if (
            abs(taxable_amount_value)
            <= output_gst_min_net_rate
        ):

            output_gst_percent = D(5)

        else:

            output_gst_percent = D(18)

        # =====================================================
        # OUTPUT GST VALUE
        # =====================================================

        output_gst_value = R2(
            taxable_amount_value
            * output_gst_percent
            /
            (
                D(100)
                + output_gst_percent
            )
        )

        # =====================================================
        # NET SALE VALUE
        # =====================================================

        net_sale_value = R2(
            taxable_amount_value
            - output_gst_value
        )

        # =====================================================
        # MARGIN
        # =====================================================

        margin_percent = fresh_margin

        margin_value = R2(
            taxable_amount_value
            * margin_percent
            /
            D(100)
        )

        # =====================================================
        # TOTAL INVOICE AMOUNT
        # =====================================================

        total_invoice_amount = R2(
            taxable_amount_value
        )

        # =====================================================
        # SET CUSTOM SIS FIELDS
        # =====================================================

        item.custom_output_gst_ = float(
            output_gst_percent
        )

        item.custom_output_gst_value = float(
            output_gst_value
        )

        item.custom_net_sale_value = float(
            net_sale_value
        )

        item.custom_margin_amount = float(
            margin_value
        )

        item.custom_margins_ = float(
            margin_percent
        )

        item.custom_total_invoice_amount = float(
            total_invoice_amount
        )

    # =========================================================
    # FINAL DELIVERY NOTE VALUES
    # =========================================================

    dn.company = stock_taking_company

    dn.customer = customer

    dn.is_return = 1

    dn.return_against = None

    dn.is_internal_customer = 0

    dn.represents_company = None

    dn.set_warehouse = default_warehouse

    # =========================================================
    # FINAL ITEM VALIDATION
    # =========================================================

    for idx, item in enumerate(
        dn.items,
        start=1
    ):

        # -----------------------------------------------------
        # WAREHOUSE
        # -----------------------------------------------------

        item.warehouse = default_warehouse

        # -----------------------------------------------------
        # INTERNAL TRANSFER FIELDS
        # -----------------------------------------------------

        if hasattr(item, "target_warehouse"):
            item.target_warehouse = None

        if hasattr(item, "from_warehouse"):
            item.from_warehouse = None

        # -----------------------------------------------------
        # QTY
        # -----------------------------------------------------

        if not item.qty:

            frappe.throw(
                _(
                    "Row {0}: Quantity is required "
                    "for Item {1}."
                ).format(
                    idx,
                    item.item_code
                )
            )

        # -----------------------------------------------------
        # RATE
        # -----------------------------------------------------

        if not item.rate:

            frappe.throw(
                _(
                    "Row {0}: MRP/Rate is missing "
                    "for Item {1}."
                ).format(
                    idx,
                    item.item_code
                )
            )

    # =========================================================
    # VALIDATE SET WAREHOUSE
    # =========================================================

    if not dn.set_warehouse:

        frappe.throw(
            _("Delivery Note Set Warehouse is missing.")
        )

    # =========================================================
    # FINAL LOG
    # =========================================================

    frappe.logger().info(
        f"""
FINAL DELIVERY NOTE RETURN
==========================
Stock Taking  : {stock_taking_name}
Company       : {dn.company}
Customer      : {dn.customer}
Set Warehouse : {dn.set_warehouse}
Internal      : {dn.is_internal_customer}
Represents    : {dn.represents_company}
Return        : {dn.is_return}
Return Against: {dn.return_against}
Warehouse     : {default_warehouse}
Items         : {len(dn.items)}
Docstatus     : {dn.docstatus}
"""
    )

    # =========================================================
    # INSERT AS DRAFT
    # =========================================================

    dn.flags.ignore_permissions = True

    dn.insert(
        ignore_permissions=True
    )

    frappe.db.commit()

    # =========================================================
    # RETURN
    # =========================================================

    return {
        "name": dn.name,
        "doctype": "Delivery Note",
        "docstatus": dn.docstatus,
        "is_return": dn.is_return,
        "customer": dn.customer,
        "company": dn.company,
        "set_warehouse": dn.set_warehouse,
    }