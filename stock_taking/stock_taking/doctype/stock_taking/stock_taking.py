# Copyright (c) 2025, bhumika.d@stackerbee.com and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class StockTaking(Document):
    pass


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


@frappe.whitelist()
def scan_barcode(code, warehouses=None):
    try:
        if isinstance(warehouses, str):
            warehouses = frappe.parse_json(warehouses)

        # ===============================
        # 🔹 SERIAL SCAN
        # ===============================
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

        # ===============================
        # 🔹 ITEM SCAN → BIN DATA
        # ===============================
        bin_filters = {
            "item_code": code
        }

        if warehouses:
            bin_filters["warehouse"] = ["in", warehouses]

        bins = frappe.get_all(
            "Bin",
            fields=["item_code", "warehouse", "actual_qty"],
            filters=bin_filters
        )

        if bins:

            # ===============================
            # 🔥 GET ACTIVE SERIALS (FIXED)
            # ===============================
            serial_filters = {
                "item_code": code,
                "status": "Active"
            }

            if warehouses:
                serial_filters["warehouse"] = ["in", warehouses]

            serials = frappe.get_all(
                "Serial No",
                fields=["name"],
                filters=serial_filters
            )

            return {
                "success": True,
                "type": "item",
                "result": bins,
                "serials": [s.name for s in serials]
            }

        return {
            "success": False,
            "message": "No Serial or Item found"
        }

    except Exception:
        frappe.log_error(frappe.get_traceback(), "scan_barcode error")
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