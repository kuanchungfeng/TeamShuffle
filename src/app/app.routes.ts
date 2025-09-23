import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "",
    loadComponent: () =>
      import("./pages/home/home.component").then((m) => m.HomeComponent),
  },
  {
    path: "grouping",
    loadComponent: () =>
      import("./pages/grouping/grouping.component").then(
        (m) => m.GroupingComponent
      ),
  },
  {
    path: "**",
    redirectTo: "",
  },
];
