import SidebarEmployee from "./SidebarEmployee";
import NavbarEmployee from "./NavbarEmployee";
import { Outlet } from "react-router-dom";

const LayoutEmployee = () => {
  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-100 via-white to-blue-300">
      <SidebarEmployee />
      <div className="flex flex-col flex-1 shadow-2xl rounded-l-3xl overflow-hidden">
        <NavbarEmployee />
        <main className="p-6 md:p-8 overflow-y-auto bg-white rounded-tl-3xl min-h-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default LayoutEmployee;
