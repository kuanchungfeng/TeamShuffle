import { Component } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatToolbarModule } from "@angular/material/toolbar";
import { RouterOutlet } from "@angular/router";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, MatToolbarModule, MatIconModule],
  template: `
    <mat-toolbar color="primary" class="shadow-md">
      <mat-icon class="mr-2">groups</mat-icon>
      <span class="text-xl font-medium">TeamShuffle - 智慧分組工具</span>
    </mat-toolbar>

    <main class="min-h-screen bg-gray-50">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [],
})
export class AppComponent {
  title = "TeamShuffle";
}
