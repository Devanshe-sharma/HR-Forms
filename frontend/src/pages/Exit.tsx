import { useEffect, useState } from "react";

const API_BASE = "http://localhost:5000/api";

type Row = {
  ser: number | string;
  [key: string]: any; // flexible keys, because your data can have dynamic columns
};

const Exit: React.FC = () => {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Fetch all rows
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/exit/`);
      const json = await res.json();
      setData(json.data || []);
    } catch (e) {
      setMsg("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle cell edit and send update to backend
  const handleCellChange = (ser: Row["ser"], key: string, value: any) => {
    setData((prev) =>
      prev.map((row) => (row.ser === ser ? { ...row, [key]: value } : row))
    );
  };

  const handleCellBlur = async (ser: Row["ser"], row: Row) => {
    try {
      setMsg(null);
      const res = await fetch(`${API_BASE}/${ser}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(row),
      });
      const json = await res.json();
      if (!json.success) {
        setMsg(json.error || "Failed to update row");
      } else {
        setMsg("Row updated successfully");
      }
    } catch (e) {
      setMsg("Update error");
    }
  };

  if (loading) return <p>Loading...</p>;

  if (!data.length) return <p>No data found</p>;

  // Get all headers from first row keys
  const headers = Object.keys(data[0]);

  return (
    <div style={{ padding: 24 }}>
      <h2>Exit Sheet Data</h2>

      <p>{msg}</p>

      <table border={1} cellPadding={5} style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} style={{ backgroundColor: "#f0f0f0" }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.ser}>
              {headers.map((key) => (
                <td key={key}>
                  <input
                    type="text"
                    value={row[key] ?? ""}
                    onChange={(e) => handleCellChange(row.ser, key, e.target.value)}
                    onBlur={() => handleCellBlur(row.ser, row)}
                    style={{ width: "100%" }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Exit;
