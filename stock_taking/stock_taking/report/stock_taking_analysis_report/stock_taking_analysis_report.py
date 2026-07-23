import frappe
from frappe.utils import flt


def execute(filters=None):
    filters = filters or {}

    columns = get_columns(filters)
    data = get_data(filters)

    total_book_stock = 0
    total_physical_stock = 0
    total_difference = 0
    total_stock_adj_qty = 0
    total_mrp = 0
    total_wsp = 0
    total_std = 0

    for d in data:
        total_book_stock += flt(d.get("book_stock"))
        total_physical_stock += flt(d.get("physical_stock"))
        total_difference += flt(d.get("difference"))
        total_stock_adj_qty += flt(d.get("stock_adj_qty"))
        total_mrp += flt(d.get("mrp"))
        total_wsp += flt(d.get("wsp"))
        total_std += flt(d.get("std"))

    data.append({
        "stock_taking": "TOTAL",
        "mrp": total_mrp,
        "wsp": total_wsp,
        "std": total_std,
        "book_stock": total_book_stock,
        "physical_stock": total_physical_stock,
        "difference": total_difference,
        "stock_adj_qty": total_stock_adj_qty
    })

    return columns, data


def get_columns(filters=None):
    columns = [
        {
            "label": "Stock Taking",
            "fieldname": "stock_taking",
            "fieldtype": "Link",
            "options": "Stock Taking",
            "width": 180
        },
        {
            "label": "Owner Site",
            "fieldname": "owner_site",
            "fieldtype": "Data",
            "width": 180
        },
        {
            "label": "Status",
            "fieldname": "status",
            "fieldtype": "Data",
            "width": 120
        },
        {
            "label": "Item Code",
            "fieldname": "item_code",
            "fieldtype": "Link",
            "options": "Item",
            "width": 180
        },
    ]

    if filters.get("show_serial_no"):
        columns.append({
            "label": "Serial No",
            "fieldname": "serial_no",
            "fieldtype": "HTML",
            "width": 400
        })

    columns.extend([
        {
            "label": "Book Stock",
            "fieldname": "book_stock",
            "fieldtype": "Float",
            "width": 120
        },
        {
            "label": "Physical Stock",
            "fieldname": "physical_stock",
            "fieldtype": "Float",
            "width": 120
        },
        {
            "label": "Difference",
            "fieldname": "difference",
            "fieldtype": "Float",
            "width": 120
        },
        {
            "label": "Stock Adj Qty",
            "fieldname": "stock_adj_qty",
            "fieldtype": "Float",
            "width": 120
        },
        {
            "label": "Brand Name",
            "fieldname": "brand_name",
            "fieldtype": "Data",
            "width": 180
        },
        {
            "label": "MRP",
            "fieldname": "mrp",
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "label": "STD",
            "fieldname": "std",
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "label": "WSP",
            "fieldname": "wsp",
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "label": "Silhouette",
            "fieldname": "silhouette",
            "fieldtype": "Data",
            "width": 150
        },
        {
            "label": "Division",
            "fieldname": "division",
            "fieldtype": "Data",
            "width": 150
        },
        {
            "label": "Stock Adj Date",
            "fieldname": "stock_adj_date",
            "fieldtype": "Date",
            "width": 120
        },
        {
            "label": "Plan Date",
            "fieldname": "plan_date",
            "fieldtype": "Date",
            "width": 120
        },
        {
            "label": "Plan Description",
            "fieldname": "plan_description",
            "fieldtype": "Data",
            "width": 220
        },
        {
            "label": "Count Of Pcs",
            "fieldname": "category1",
            "fieldtype": "Data",
            "width": 120
        },
        {
            "label": "Top Fabric",
            "fieldname": "category2",
            "fieldtype": "Data",
            "width": 120
        },
        {
            "label": "Color",
            "fieldname": "category3",
            "fieldtype": "Data",
            "width": 120
        },
        {
            "label": "Sup Design No",
            "fieldname": "category4",
            "fieldtype": "Data",
            "width": 120
        },
        {
            "label": "Size",
            "fieldname": "category5",
            "fieldtype": "Data",
            "width": 120
        },
        {
            "label": "Block",
            "fieldname": "category6",
            "fieldtype": "Data",
            "width": 120
        },
        {
            "label": "Stock Point",
            "fieldname": "stock_point",
            "fieldtype": "Link",
            "options": "Warehouse",
            "width": 180
        },
    ])

    return columns


def get_data(filters):
    cond = []
    values = {}

    if filters.get("company"):
        cond.append("st.company = %(company)s")
        values["company"] = filters.get("company")

    if filters.get("stock_taking"):
        cond.append("st.name = %(stock_taking)s")
        values["stock_taking"] = filters.get("stock_taking")

    if filters.get("item_code"):
        cond.append("sti.item_code = %(item_code)s")
        values["item_code"] = filters.get("item_code")

    if filters.get("warehouse"):
        cond.append("sti.warehouse = %(warehouse)s")
        values["warehouse"] = filters.get("warehouse")

    if filters.get("from_date"):
        cond.append(
            "(st.plan_date IS NULL OR st.plan_date >= %(from_date)s)"
        )
        values["from_date"] = filters.get("from_date")

    if filters.get("to_date"):
        cond.append(
            "(st.plan_date IS NULL OR st.plan_date <= %(to_date)s)"
        )
        values["to_date"] = filters.get("to_date")

    if filters.get("status"):
        status_map = {
            "Draft": 0,
            "Submitted": 1,
            "Cancelled": 2
        }

        cond.append("st.docstatus = %(docstatus)s")
        values["docstatus"] = status_map.get(filters.get("status"))

    where_conditions = " AND " + " AND ".join(cond) if cond else ""

    return frappe.db.sql(f"""
        SELECT
            st.name AS stock_taking,
            st.company AS owner_site,

            CASE
                WHEN st.docstatus = 0 THEN 'Draft'
                WHEN st.docstatus = 1 THEN 'Submitted'
                WHEN st.docstatus = 2 THEN 'Cancelled'
            END AS status,

            sti.item_code AS item_code,

            REPLACE(
                COALESCE(sti.serial_no, ''),
                '\\n',
                '<br>'
            ) AS serial_no,

            i.brand AS brand_name,

            (
                SELECT ip.price_list_rate
                FROM `tabItem Price` ip
                WHERE ip.item_code = sti.item_code
                  AND ip.price_list = 'MRP'
                ORDER BY ip.modified DESC, ip.name DESC
                LIMIT 1
            ) AS mrp,

            (
                SELECT ip.price_list_rate
                FROM `tabItem Price` ip
                WHERE ip.item_code = sti.item_code
                  AND ip.price_list = 'STD'
                ORDER BY ip.modified DESC, ip.name DESC
                LIMIT 1
            ) AS std,

            (
                SELECT ip.price_list_rate
                FROM `tabItem Price` ip
                WHERE ip.item_code = sti.item_code
                  AND ip.price_list = 'WSP'
                ORDER BY ip.modified DESC, ip.name DESC
                LIMIT 1
            ) AS wsp,

            i.custom_silvet AS silhouette,
            i.item_group AS division,

            (
                SELECT MAX(se_d.posting_date)
                FROM `tabStock Entry` se_d
                WHERE se_d.custom_stock_taking = st.name
                  AND se_d.docstatus IN (0, 1)
            ) AS stock_adj_date,

            st.plan_date AS plan_date,
            st.remark AS plan_description,

            i.custom_count_of_pcs AS category1,
            i.custom_top_fabrics AS category2,
            i.custom_colour_name AS category3,
            i.custom_sup_design_no AS category4,
            i.custom_size AS category5,
            i.custom_block AS category6,

            sti.warehouse AS stock_point,

            COALESCE(b.actual_qty, 0) AS book_stock,

            COALESCE(sti.physical_count, 0) AS physical_stock,

            (
                COALESCE(sti.physical_count, 0)
                - COALESCE(b.actual_qty, 0)
            ) AS difference,

            (
                COALESCE((
                    SELECT SUM(sed_mr.qty)
                    FROM `tabStock Entry` se_mr
                    INNER JOIN `tabStock Entry Detail` sed_mr
                        ON sed_mr.parent = se_mr.name
                    WHERE se_mr.custom_stock_taking = st.name
                      AND se_mr.stock_entry_type = 'Material Receipt'
                      AND se_mr.docstatus IN (0, 1)
                      AND sed_mr.item_code = sti.item_code
                      AND sed_mr.t_warehouse = sti.warehouse
                ), 0)
                -
                COALESCE((
                    SELECT SUM(sed_mi.qty)
                    FROM `tabStock Entry` se_mi
                    INNER JOIN `tabStock Entry Detail` sed_mi
                        ON sed_mi.parent = se_mi.name
                    WHERE se_mi.custom_stock_taking = st.name
                      AND se_mi.stock_entry_type = 'Material Issue'
                      AND se_mi.docstatus IN (0, 1)
                      AND sed_mi.item_code = sti.item_code
                      AND sed_mi.s_warehouse = sti.warehouse
                ), 0)
            ) AS stock_adj_qty

        FROM `tabStock Taking` st

        INNER JOIN `tabStock taking Items` sti
            ON sti.parent = st.name

        LEFT JOIN `tabBin` b
            ON b.item_code = sti.item_code
            AND b.warehouse = sti.warehouse

        LEFT JOIN `tabItem` i
            ON i.name = sti.item_code

        WHERE 1=1
        {where_conditions}

        ORDER BY
            st.name DESC,
            sti.item_code ASC

    """, values, as_dict=1)