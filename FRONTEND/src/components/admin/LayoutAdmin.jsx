import Sidebar from "./Sidebar";  // now from admin folder
import Navbar from "./Navbar";
import { Outlet } from "react-router-dom";

const LayoutAdmin = () => {
  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-100 via-white to-blue-300">
      <Sidebar />
      <div className="flex flex-col flex-1 shadow-2xl rounded-l-3xl overflow-hidden">
        <Navbar />
        <main className="p-6 md:p-8 overflow-y-auto bg-white rounded-tl-3xl min-h-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default LayoutAdmin;
