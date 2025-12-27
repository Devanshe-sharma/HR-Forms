import { AppBar, Toolbar, Box } from "@mui/material";
import { Link } from "react-router-dom";

export default function Navbar() {
    return (
        <AppBar
            position="fixed"
            sx={{
                zIndex: 1400,
                backgroundColor: "#76834fff",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            }}
        >
            <Toolbar sx={{ py: 0 }}>
                <Link to="/" style={{ textDecoration: "none" }}>
                    <Box
                        component="img"
                        src="https://ik.imagekit.io/wovz8p4ck/Logo%20and%20navbar/image%201.png?updatedAt=1760330977578"
                        alt="Company Logo"
                        sx={{
                            height: { xs: 30, sm: 40, md: 40 },
                            width: "auto",
                            objectFit: "contain",
                        }}
                    />
                </Link>
            </Toolbar>
        </AppBar>
    );
}
