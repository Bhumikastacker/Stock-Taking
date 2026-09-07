import frappe
from frappe import _
from frappe.model.document import Document

					
def execute(filters=None):
    columns = get_columns(filters)
    data = get_data(filters)

    # =========================
    # CUSTOM TOTALS
    # =========================
    # total_book_stock = 0
    # total_physical_stock = 0
    # total_difference = 0
    # total_stock_adj_qty = 0
    # total_mrp = 0
    # total_wsp = 0
    # total_std = 0

    # for d in data:
    #     total_book_stock += flt(d.get("book_stock"))
    #     total_physical_stock += flt(d.get("physical_stock"))
    #     total_difference += flt(d.get("difference"))
    #     total_stock_adj_qty += flt(d.get("stock_adj_qty"))
    #     total_mrp += flt(d.get("mrp"))
    #     total_wsp += flt(d.get("wsp"))
    #     total_std += flt(d.get("std"))

    # =========================
    # TOTAL ROW
    # =========================
    # data.append({
    #     "stock_taking": "TOTAL",
    #     "mrp": total_mrp,
    #     "wsp": total_wsp,
    #     "std": total_std,
    #     "book_stock": total_book_stock,
    #     "physical_stock": total_physical_stock,
    #     "difference": total_difference,
    #     "stock_adj_qty": total_stock_adj_qty,
    # })

    return columns, data


def get_columns(filters=None):
    columns = [
        {
            "label": "Stock Taking",
            "fieldname": "stock_taking",
            "fieldtype": "Link",
            "options": "Stock Taking",
            "width": 180,
        },
        {
            "label": "Owner Site",
            "fieldname": "owner_site",
            "fieldtype": "Data",
            "width": 180,
        },
        {
            "label": "Status",
            "fieldname": "status",
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "label": "Item Code",
            "fieldname": "item_code",
            "fieldtype": "Link",
            "options": "Item",
            "width": 180,
        },
    ]

    if filters.get("show_serial_no"):
        columns.append({
            "label": "Serial No",
            "fieldname": "serial_no",
            "fieldtype": "HTML",
            "width": 400,
        })

    columns.extend([
        {
            "label": "Brand Name",
            "fieldname": "brand_name",
            "fieldtype": "Data",
            "width": 180,
        },
        {
            "label": "MRP",
            "fieldname": "mrp",
            "fieldtype": "Currency",
            "width": 120,
        },
        {
            "label": "STD",
            "fieldname": "std",
            "fieldtype": "Currency",
            "width": 120,
        },
        {
            "label": "WSP",
            "fieldname": "wsp",
            "fieldtype": "Currency",
            "width": 120,
        },
        {
            "label": "Silhouette",
            "fieldname": "silhouette",
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "label": "Division",
            "fieldname": "division",
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "label": "Stock Adj Date",
            "fieldname": "stock_adj_date",
            "fieldtype": "Date",
            "width": 120,
        },
        {
            "label": "Plan Date",
            "fieldname": "plan_date",
            "fieldtype": "Date",
            "width": 120,
        },
        {
            "label": "Plan Description",
            "fieldname": "plan_description",
            "fieldtype": "Data",
            "width": 220,
        },
        {
            "label": "Count Of Pcs",
            "fieldname": "category1",
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "label": "Top Fabric",
            "fieldname": "category2",
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "label": "Color",
            "fieldname": "category3",
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "label": "Sup Design No",
            "fieldname": "category4",
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "label": "Size",
            "fieldname": "category5",
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "label": "Block",
            "fieldname": "category6",
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "label": "Book Stock",
            "fieldname": "book_stock",
            "fieldtype": "Float",
            "width": 120,
        },
        {
            "label": "Physical Stock",
            "fieldname": "physical_stock",
            "fieldtype": "Float",
            "width": 120,
        },
        {
            "label": "Difference",
            "fieldname": "difference",
            "fieldtype": "Float",
            "width": 120,
        },
        {
            "label": "Excess Qty",
            "fieldname": "excess_qty",
            "fieldtype": "Float",
            "width": 120,
        },
        {
            "label": "Short Qty",
            "fieldname": "short_qty",
            "fieldtype": "Float",
            "width": 120,
        },
        {
            "label": "Stock Adj Qty",
            "fieldname": "stock_adj_qty",
            "fieldtype": "Float",
            "width": 120,
        },
        {
            "label": "Stock Point",
            "fieldname": "stock_point",
            "fieldtype": "Link",
            "options": "Warehouse",
            "width": 180,
        },
    ])

    return columns




# def get_data(filters):

# 		cond = []
# 		values = {}

# 		# =========================
# 		# FILTERS
# 		# =========================

# 		if filters.get("company"):
# 			cond.append("st.company = %(company)s")
# 			values["company"] = filters.get("company")

# 		if filters.get("stock_taking"):
# 			cond.append("st.name = %(stock_taking)s")
# 			values["stock_taking"] = filters.get("stock_taking")

# 		if filters.get("item_code"):
# 			cond.append("b.item_code = %(item_code)s")
# 			values["item_code"] = filters.get("item_code")

# 		if filters.get("warehouse"):
# 			cond.append("b.warehouse = %(warehouse)s")
# 			values["warehouse"] = filters.get("warehouse")

# 		if filters.get("from_date"):
# 			cond.append("st.plan_date >= %(from_date)s")
# 			values["from_date"] = filters.get("from_date")

# 		if filters.get("to_date"):
# 			cond.append("st.plan_date <= %(to_date)s")
# 			values["to_date"] = filters.get("to_date")

# 		if filters.get("status"):
# 			status_map = {"Draft": 0, "Submitted": 1, "Cancelled": 2}
# 			cond.append("st.docstatus = %(docstatus)s")
# 			values["docstatus"] = status_map.get(filters.get("status"))

# 		where_conditions = " AND " + " AND ".join(cond) if cond else ""

# 		latest_plan_date = None
# 		latest_plan_time = None

# 		if filters.get("company") and filters.get("to_date"):

# 			latest_stock = frappe.db.sql("""
# 				SELECT
# 					plan_date,
# 					plan_time
# 				FROM `tabStock Taking`
# 				WHERE company = %(company)s
# 				AND plan_date <= %(to_date)s
# 				ORDER BY
# 					plan_date DESC,
# 					plan_time DESC
# 				LIMIT 1
# 			""", {
# 				"company": filters.get("company"),
# 				"to_date": filters.get("to_date")
# 			}, as_dict=True)

# 			if latest_stock:
# 				latest_plan_date = latest_stock[0].plan_date
# 				latest_plan_time = latest_stock[0].plan_time

# 		values["latest_plan_date"] = latest_plan_date
# 		values["latest_plan_time"] = latest_plan_time
# 		# =========================================================
# 		# LOGIC
# 		# ---------------------------------------------------------
	

# 		return frappe.db.sql(f"""

# 			SELECT

# 				st.name                                   AS stock_taking,
# 				st.company                                AS owner_site,

# 				CASE
# 					WHEN st.docstatus = 0 THEN 'Draft'
# 					WHEN st.docstatus = 1 THEN 'Submitted'
# 					WHEN st.docstatus = 2 THEN 'Cancelled'
# 				END                                        AS status,

# 				b.item_code                               AS item_code,

# 				REPLACE(COALESCE(sti.serial_no, ''), '\n', '<br>')
# 															AS serial_no,

# 				i.brand                                    AS brand_name,

# 				--  MRP: latest entry (highest modified, tie-break by name)
# 				(
# 					SELECT ip.price_list_rate
# 					FROM `tabItem Price` ip
# 					WHERE ip.item_code = b.item_code
# 					AND ip.price_list = 'MRP'
# 					ORDER BY ip.modified DESC, ip.name DESC
# 					LIMIT 1
# 				)                                           AS mrp,

# 				--  STD: latest entry
# 				(
# 					SELECT ip.price_list_rate
# 					FROM `tabItem Price` ip
# 					WHERE ip.item_code = b.item_code
# 					AND ip.price_list = 'STD'
# 					ORDER BY ip.modified DESC, ip.name DESC
# 					LIMIT 1
# 				)                                           AS std,

# 				--  WSP: latest entry
# 				(
# 					SELECT ip.price_list_rate
# 					FROM `tabItem Price` ip
# 					WHERE ip.item_code = b.item_code
# 					AND ip.price_list = 'WSP'
# 					ORDER BY ip.modified DESC, ip.name DESC
# 					LIMIT 1
# 				)                                           AS wsp,

# 				i.custom_silvet                            AS silhouette,
# 				i.item_group                               AS division,

# 				-- informational: kisi linked Stock Entry ki latest posting date
# 				(
# 					SELECT MAX(se_d.posting_date)
# 					FROM `tabStock Entry` se_d
# 					WHERE se_d.custom_stock_taking = st.name
# 					AND se_d.docstatus IN (0, 1)
# 					AND TIMESTAMP(se_d.posting_date,se_d.posting_time)
# 						<= TIMESTAMP(%(latest_plan_date)s,%(latest_plan_time)s)
# 				)                                           AS stock_adj_date,

# 				st.plan_date                                AS plan_date,
# 				st.remark                                   AS plan_description,

# 				i.custom_count_of_pcs                       AS category1,
# 				i.custom_top_fabrics                        AS category2,
# 				i.custom_colour_name                        AS category3,
# 				i.custom_sup_design_no                      AS category4,
# 				i.custom_size                                AS category5,
# 				i.custom_block                               AS category6,

# 				b.warehouse                                  AS stock_point,

# 				-- ✅ BOOK STOCK: Bin.actual_qty directly
# 				b.actual_qty                                 AS book_stock,

# 				-- ✅ PHYSICAL STOCK: Stock taking Items.physical_count
# 				COALESCE(sti.physical_count, 0)              AS physical_stock,

# 				-- ✅ DIFFERENCE: Physical - Book
# 				(
# 					COALESCE(sti.physical_count, 0) - b.actual_qty
# 				)                                              AS difference,
    

# -- Excess Qty (Material Receipt)
# COALESCE((
#     SELECT SUM(sed_mr.qty)
#     FROM `tabStock Entry` se_mr
#     INNER JOIN `tabStock Entry Detail` sed_mr
#         ON sed_mr.parent = se_mr.name
#     WHERE se_mr.custom_stock_taking = st.name
#       AND se_mr.stock_entry_type = 'Material Receipt'
#       AND se_mr.docstatus IN (0,1)
#       AND sed_mr.item_code = b.item_code
#       AND sed_mr.t_warehouse = b.warehouse
# ), 0) AS excess_qty,

# -- Short Qty (Material Issue)
# (
#     -1 * COALESCE((
#         SELECT SUM(sed_mi.qty)
#         FROM `tabStock Entry` se_mi
#         INNER JOIN `tabStock Entry Detail` sed_mi
#             ON sed_mi.parent = se_mi.name
#         WHERE se_mi.custom_stock_taking = st.name
#           AND se_mi.stock_entry_type = 'Material Issue'
#           AND se_mi.docstatus IN (0,1)
#           AND sed_mi.item_code = b.item_code
#           AND sed_mi.s_warehouse = b.warehouse
#     ), 0)
# ) AS short_qty,

# 				(
#     COALESCE((
#         SELECT SUM(sed_mr.qty)
#         FROM `tabStock Entry` se_mr
#         INNER JOIN `tabStock Entry Detail` sed_mr
#             ON sed_mr.parent = se_mr.name
#         WHERE se_mr.custom_stock_taking = st.name
#           AND se_mr.stock_entry_type = 'Material Receipt'
#           AND se_mr.docstatus IN (0,1)
#           AND sed_mr.item_code = b.item_code
#           AND sed_mr.t_warehouse = b.warehouse
#     ), 0)

#     -

#     COALESCE((
#         SELECT SUM(sed_mi.qty)
#         FROM `tabStock Entry` se_mi
#         INNER JOIN `tabStock Entry Detail` sed_mi
#             ON sed_mi.parent = se_mi.name
#         WHERE se_mi.custom_stock_taking = st.name
#           AND se_mi.stock_entry_type = 'Material Issue'
#           AND se_mi.docstatus IN (0,1)
#           AND sed_mi.item_code = b.item_code
#           AND sed_mi.s_warehouse = b.warehouse
#     ), 0)

# ) AS stock_adj_qty

# 			FROM `tabStock Taking` st

# INNER JOIN (
#     SELECT DISTINCT parent, warehouse
#     FROM `tabStock taking Items`
# ) st_wh
#     ON st_wh.parent = st.name

# INNER JOIN (
#     SELECT item_code, warehouse, actual_qty
#     FROM `tabBin`

#     UNION

#     SELECT
#         sti.item_code,
#         sti.warehouse,
#         0 AS actual_qty
#     FROM `tabStock taking Items` sti
#     WHERE NOT EXISTS (
#         SELECT 1
#         FROM `tabBin` b
#         WHERE b.item_code = sti.item_code
#           AND b.warehouse = sti.warehouse
#     )
# ) b
#     ON b.warehouse = st_wh.warehouse

# LEFT JOIN `tabStock taking Items` sti
#     ON sti.parent = st.name
#     AND sti.item_code = b.item_code
#     AND sti.warehouse = b.warehouse

# LEFT JOIN `tabItem` i
#     ON i.name = b.item_code

# 			WHERE 1=1
# 			{where_conditions}
			

# 			ORDER BY
# 				st.name DESC,
# 				b.item_code ASC

# 		""", values, as_dict=1)

def get_data(filters):

    cond = []
    values = {}

    # =========================================================
    # BOOK STOCK TO DATE
    # =========================================================

    book_stock_to_date = filters.get("to_date")

    if not book_stock_to_date:
        book_stock_to_date = frappe.utils.getdate()

    values["book_stock_to_date"] = book_stock_to_date

    # =========================================================
    # FILTERS
    # =========================================================

    if filters.get("company"):
        cond.append("st.company = %(company)s")
        values["company"] = filters.get("company")

    if filters.get("stock_taking"):
        cond.append("st.name = %(stock_taking)s")
        values["stock_taking"] = filters.get("stock_taking")

    if filters.get("item_code"):
        cond.append("iw.item_code = %(item_code)s")
        values["item_code"] = filters.get("item_code")

    if filters.get("warehouse"):
        cond.append("iw.warehouse = %(warehouse)s")
        values["warehouse"] = filters.get("warehouse")

    if filters.get("from_date"):
        cond.append("st.plan_date >= %(from_date)s")
        values["from_date"] = filters.get("from_date")

    if filters.get("to_date"):
        cond.append("st.plan_date <= %(to_date)s")
        values["to_date"] = filters.get("to_date")

    if filters.get("status"):

        status_map = {
            "Draft": 0,
            "Submitted": 1,
            "Cancelled": 2
        }

        cond.append(
            "st.docstatus = %(docstatus)s"
        )

        values["docstatus"] = status_map.get(
            filters.get("status")
        )

    where_conditions = (
        " AND " + " AND ".join(cond)
        if cond
        else ""
    )

    # =========================================================
    # DATA
    # =========================================================

    return frappe.db.sql(
        f"""

        SELECT

            st.name AS stock_taking,

            st.company AS owner_site,

            CASE
                WHEN st.docstatus = 0 THEN 'Draft'
                WHEN st.docstatus = 1 THEN 'Submitted'
                WHEN st.docstatus = 2 THEN 'Cancelled'
            END AS status,

            iw.item_code AS item_code,


            -- =================================================
            -- SERIAL NO
            -- =================================================

            REPLACE(
                COALESCE(sti.serial_no, ''),
                '\\n',
                '<br>'
            ) AS serial_no,


            -- =================================================
            -- ITEM DETAILS
            -- =================================================

            i.brand AS brand_name,


            -- =================================================
            -- MRP
            -- =================================================

            (
                SELECT ip.price_list_rate

                FROM `tabItem Price` ip

                WHERE ip.item_code = iw.item_code
                  AND ip.price_list = 'MRP'

                ORDER BY
                    ip.modified DESC,
                    ip.name DESC

                LIMIT 1

            ) AS mrp,


            -- =================================================
            -- STD
            -- =================================================

            (
                SELECT ip.price_list_rate

                FROM `tabItem Price` ip

                WHERE ip.item_code = iw.item_code
                  AND ip.price_list = 'STD'

                ORDER BY
                    ip.modified DESC,
                    ip.name DESC

                LIMIT 1

            ) AS std,


            -- =================================================
            -- WSP
            -- =================================================

            (
                SELECT ip.price_list_rate

                FROM `tabItem Price` ip

                WHERE ip.item_code = iw.item_code
                  AND ip.price_list = 'WSP'

                ORDER BY
                    ip.modified DESC,
                    ip.name DESC

                LIMIT 1

            ) AS wsp,


            -- =================================================
            -- ITEM CUSTOM FIELDS
            -- =================================================

            i.custom_silvet AS silhouette,

            i.item_group AS division,


            -- =================================================
            -- STOCK ADJUSTMENT DATE
            -- =================================================

            (
                SELECT MAX(se_d.posting_date)

                FROM `tabStock Entry` se_d

                WHERE se_d.custom_stock_taking = st.name

                  AND se_d.docstatus IN (0, 1)

                  AND TIMESTAMP(
                        se_d.posting_date,
                        se_d.posting_time
                      )
                      <= TIMESTAMP(
                        st.plan_date,
                        st.plan_time
                      )

            ) AS stock_adj_date,


            -- =================================================
            -- PLAN DETAILS
            -- =================================================

            st.plan_date AS plan_date,

            st.remark AS plan_description,


            -- =================================================
            -- CATEGORY FIELDS
            -- =================================================

            i.custom_count_of_pcs AS category1,

            i.custom_top_fabrics AS category2,

            i.custom_colour_name AS category3,

            i.custom_sup_design_no AS category4,

            i.custom_size AS category5,

            i.custom_block AS category6,


            -- =================================================
            -- WAREHOUSE
            -- =================================================

            iw.warehouse AS stock_point,


            -- =========================================================
            -- BOOK STOCK
            --
            -- IMPORTANT:
            --
            -- tabBin.actual_qty NOT USED
            --
            -- Stock Ledger cumulative balance upto To Date.
            -- =========================================================

            COALESCE(
                (
                    SELECT SUM(sle.actual_qty)

                    FROM `tabStock Ledger Entry` sle

                    WHERE sle.item_code = iw.item_code

                      AND sle.warehouse = iw.warehouse

                      AND sle.company = st.company

                      AND sle.is_cancelled = 0

                      AND sle.posting_date
                          <= %(book_stock_to_date)s

                ),
                0
            ) AS book_stock,


            -- =========================================================
            -- PHYSICAL STOCK
            --
            -- Same item + warehouse ki duplicate child rows
            -- already grouped in sti subquery.
            -- =========================================================

            COALESCE(
                sti.physical_count,
                0
            ) AS physical_stock,


            -- =========================================================
            -- DIFFERENCE
            --
            -- Physical - Book
            --
            -- IMPORTANT:
            -- tabBin.actual_qty NOT USED
            -- =========================================================

            (
                COALESCE(
                    sti.physical_count,
                    0
                )

                -

                COALESCE(
                    (
                        SELECT SUM(sle.actual_qty)

                        FROM `tabStock Ledger Entry` sle

                        WHERE sle.item_code = iw.item_code

                          AND sle.warehouse = iw.warehouse

                          AND sle.company = st.company

                          AND sle.is_cancelled = 0

                          AND sle.posting_date
                              <= %(book_stock_to_date)s

                    ),
                    0
                )

            ) AS difference,


                        -- =========================================================
            -- EXCESS QTY
            --
            -- Delivery Note Return
            -- Return DN qty negative hoti hai,
            -- report me Excess Qty positive dikhayenge.
            -- =========================================================

            (
                -1 *
                COALESCE(
                    (
                        SELECT SUM(dni_return.qty)
                        FROM `tabDelivery Note` dn_return

                        INNER JOIN `tabDelivery Note Item` dni_return
                            ON dni_return.parent = dn_return.name

                        WHERE dn_return.custom_stock_taking = st.name
                          AND dn_return.is_return = 1
                          AND dn_return.docstatus IN (0, 1)

                          AND dni_return.item_code =
                              iw.item_code

                          AND dni_return.warehouse =
                              iw.warehouse
                    ),
                    0
                )
            ) AS excess_qty,


            -- =========================================================
            -- SHORT QTY
            --
            -- Normal Delivery Note
            -- Normal DN qty positive hoti hai,
            -- report me Short Qty negative dikhayenge.
            -- =========================================================

            (
                -1 *
                COALESCE(
                    (
                        SELECT SUM(dni_short.qty)
                        FROM `tabDelivery Note` dn_short

                        INNER JOIN `tabDelivery Note Item` dni_short
                            ON dni_short.parent = dn_short.name

                        WHERE dn_short.custom_stock_taking = st.name
                          AND IFNULL(dn_short.is_return, 0) = 0
                          AND dn_short.docstatus IN (0, 1)

                          AND dni_short.item_code =
                              iw.item_code

                          AND dni_short.warehouse =
                              iw.warehouse
                    ),
                    0
                )
            ) AS short_qty,


            -- =========================================================
            -- STOCK ADJ QTY
            --
            -- Short Qty + Excess Qty
            --
            -- Example:
            -- Short  = -5
            -- Excess = +2
            -- Adjustment = -3
            -- =========================================================

            (
                (
                    -1 *
                    COALESCE(
                        (
                            SELECT SUM(dni_short_adj.qty)
                            FROM `tabDelivery Note` dn_short_adj

                            INNER JOIN `tabDelivery Note Item` dni_short_adj
                                ON dni_short_adj.parent =
                                   dn_short_adj.name

                            WHERE dn_short_adj.custom_stock_taking =
                                  st.name

                              AND IFNULL(
                                  dn_short_adj.is_return, 0
                              ) = 0

                              AND dn_short_adj.docstatus IN (0, 1)

                              AND dni_short_adj.item_code =
                                  iw.item_code

                              AND dni_short_adj.warehouse =
                                  iw.warehouse
                        ),
                        0
                    )
                )

                +

                (
                    -1 *
                    COALESCE(
                        (
                            SELECT SUM(dni_return_adj.qty)
                            FROM `tabDelivery Note` dn_return_adj

                            INNER JOIN `tabDelivery Note Item`
                                dni_return_adj
                                ON dni_return_adj.parent =
                                   dn_return_adj.name

                            WHERE dn_return_adj.custom_stock_taking =
                                  st.name

                              AND dn_return_adj.is_return = 1

                              AND dn_return_adj.docstatus IN (0, 1)

                              AND dni_return_adj.item_code =
                                  iw.item_code

                              AND dni_return_adj.warehouse =
                                  iw.warehouse
                        ),
                        0
                    )
                )
            ) AS stock_adj_qty


        -- =========================================================
        -- STOCK TAKING
        -- =========================================================

        FROM `tabStock Taking` st


        -- =========================================================
        -- ITEM-WAREHOUSE DATASET
        --
        -- IMPORTANT:
        -- DISTINCT wrapper prevents duplicate item/warehouse rows.
        -- =========================================================

        INNER JOIN (

            SELECT DISTINCT

                x.stock_taking,

                x.item_code,

                x.warehouse

            FROM (

                -- =====================================================
                -- PART 1
                --
                -- Items having stock ledger balance in the
                -- Stock Taking warehouse.
                -- =====================================================

                SELECT

                    st1.name AS stock_taking,

                    sle.item_code,

                    sle.warehouse

                FROM `tabStock Taking` st1


                INNER JOIN (

                    SELECT DISTINCT

                        parent,

                        warehouse

                    FROM `tabStock taking Items`

                ) st_wh1

                    ON st_wh1.parent =
                       st1.name


                INNER JOIN `tabStock Ledger Entry` sle

                    ON sle.warehouse =
                       st_wh1.warehouse

                    AND sle.company =
                        st1.company

                    AND sle.is_cancelled = 0

                    AND (

                        sle.posting_date <
                        st1.plan_date

                        OR (

                            sle.posting_date =
                            st1.plan_date

                            AND COALESCE(
                                sle.posting_time,
                                '00:00:00'
                            )
                            <= COALESCE(
                                st1.plan_time,
                                '23:59:59'
                            )

                        )

                    )


                GROUP BY

                    st1.name,

                    sle.item_code,

                    sle.warehouse


                HAVING
                    SUM(sle.actual_qty) != 0


                UNION


                -- =====================================================
                -- PART 2
                --
                -- Manually scanned items.
                -- =====================================================

                SELECT DISTINCT

                    sti1.parent AS stock_taking,

                    sti1.item_code,

                    sti1.warehouse

                FROM `tabStock taking Items` sti1

            ) x

        ) iw


            ON iw.stock_taking =
               st.name


        -- =========================================================
        -- STOCK TAKING ITEMS
        --
        -- IMPORTANT:
        --
        -- Same item + warehouse multiple rows ko ONE row
        -- me aggregate kar rahe hain.
        -- =========================================================

        LEFT JOIN (

            SELECT

                parent,

                item_code,

                warehouse,


                -- =================================================
                -- PHYSICAL COUNT
                -- =================================================

                SUM(
                    COALESCE(
                        physical_count,
                        0
                    )
                ) AS physical_count,


                -- =================================================
                -- SERIAL NO
                -- =================================================

                GROUP_CONCAT(
                    DISTINCT
                    NULLIF(serial_no, '')

                    SEPARATOR '\n'
                ) AS serial_no


            FROM `tabStock taking Items`


            GROUP BY

                parent,

                item_code,

                warehouse

        ) sti


            ON sti.parent =
               st.name

            AND sti.item_code =
                iw.item_code

            AND sti.warehouse =
                iw.warehouse


        -- =========================================================
        -- ITEM MASTER
        -- =========================================================

        LEFT JOIN `tabItem` i

            ON i.name =
               iw.item_code


        -- =========================================================
        -- FILTERS
        -- =========================================================

        WHERE 1 = 1

        {where_conditions}


        -- =========================================================
        -- ORDER
        -- =========================================================

        ORDER BY

            st.name DESC,

            iw.item_code ASC

        """,
        values,
        as_dict=1
    )