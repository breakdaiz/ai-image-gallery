import { Button } from "@/components/ui/button";
import React from "react";

function HomePage() {
  return (
    <div className='p-5 flex flex-col w-max gap-5'>
      <h1>Home Page</h1>
      <Button variant={"outline"}>Click Me</Button>
    </div>
  );
}

export default HomePage;
