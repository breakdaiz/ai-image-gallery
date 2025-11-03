import React from "react";
import { Upload, LogOut, Search, ImageIcon } from "lucide-react";

function NavBar() {
  return (
    <header className='flex items-center justify-between p-4 bg-white shadow'>
      <h1 className='flex items-center gap-2 text-xl font-bold text-brand-700'>
        <ImageIcon className='w-5 h-5' />
        AI Image Gallery
      </h1>
      <button className='flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded hover:bg-brand-700'>
        <LogOut className='w-4 h-4' /> Logout
      </button>
    </header>
  );
}

export default NavBar;
