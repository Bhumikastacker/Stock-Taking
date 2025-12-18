# Copyright (c) 2025, bhumika.d@stackerbee.com and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class StockTaking(Document):
    pass


@frappe.whitelist()
def scan_barcode(code, warehouses=None):
    try:
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

        if isinstance(warehouses, str):
            warehouses = frappe.parse_json(warehouses)

        bins = frappe.get_all(
            "Bin",
            fields=["item_code", "warehouse", "actual_qty"],
            filters={
                "item_code": code,
                "warehouse": ["in", warehouses or []]
            },
            limit_page_length=50
        )

        if bins:
            return {
                "success": True,
                "type": "item",
                "result": bins
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
