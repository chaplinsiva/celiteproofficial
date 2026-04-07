"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const HIDE_HEADER_FOOTER_ROUTES = [
    "/editor",
    "/render",
    "/admin",
    "/dashboard",
    "/pricing",
];

export default function LayoutClient({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    // Check if the current route should hide the header and footer
    // We check if the pathname starts with any of the restricted routes
    // to account for dynamic segments like /templates/[slug]/editor/[id]
    const shouldHide = HIDE_HEADER_FOOTER_ROUTES.some(route =>
        pathname.includes(route)
    );

    if (shouldHide) {
        return <>{children}</>;
    }

    return (
        <>
            <Header />
            {children}
            <Footer />
        </>
    );
}
