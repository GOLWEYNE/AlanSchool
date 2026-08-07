import { Key, ReactElement, JSXElementConstructor, ReactNode, ReactPortal, AwaitedReactNode } from "react";

const Table = ({
    columns,
    renderRow,
    data
}: {
    columns: { header: string; accessor: string; className?: string }[];
    renderRow: (item: any) => React.ReactNode;
    data: any[];
}) => {
    return(
        <div className="data-table-shell mt-4">
        <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-50 via-sky-50 to-yellow-50 border-b border-blue-100">
                <tr className="text-left text-blue-700 text-sm">
                    {columns.map((col) => ( 
                        <th key={col.accessor} className={`${col.className || ""} px-4 py-3 font-semibold uppercase tracking-wide text-[11px]`}>{col.header}</th>
                    ))}
                </tr>
            </thead>
            <tbody>{data.map((item: any) => renderRow(item))}</tbody>
        </table>
        </div>
    )
}

export default Table;