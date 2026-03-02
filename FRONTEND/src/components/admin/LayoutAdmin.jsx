import Sidebar from "./Sidebar";  // now from admin folder
import Navbar from "./Navbar";
import { Outlet } from "react-router-dom";

const LayoutAdmin = () => {
  return (
    <div className="flex h-screen w-screen m-0 p-0 bg-gradient-to-br from-blue-100 via-white to-blue-300">
      <Sidebar />

      <div className="flex flex-col flex-1 m-0 p-0 overflow-hidden">
        <Navbar />

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

      </div>
    </div>
  );
};


export default LayoutAdmin;
