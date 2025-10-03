"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "./firebase";

export default function CheckAuth({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/auth/login"); // redirect if not logged in
      } else {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (isLoading) {
    return <p>Loading...</p>;
  }

  return <>{children}</>;
}






// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import { auth } from "./firebase";

// export default function CheckAuth({ children }) {
//   const router = useRouter();
//   const [isChecking, setIsChecking] = useState(true);

//   useEffect(() => {
//     // 🔹 Check immediately (without waiting for listener)
//     const user = auth.currentUser;

//     if (!user) {
//       router.replace("/auth/login"); // instant redirect
//       return;
//     }

//     // 🔹 Keep listener for changes (login/logout while app is open)
//     const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
//       if (!firebaseUser) {
//         router.replace("/auth/login");
//       } else {
//         setIsChecking(false);
//       }
//     });

//     return () => unsubscribe();
//   }, [router]);

//   if (isChecking) {
//     return <p>Loading...</p>;
//   }

//   return <>{children}</>;
// }
