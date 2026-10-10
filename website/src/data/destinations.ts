export type Destination = {
  name: string;
  lat: number;
  lng: number;
  image: string;
};

export const DESTINATIONS: Destination[] = [
  { name: "New York", lat: 40.71, lng: -74.01, image: "/images/city-dusk.png" },
  { name: "London", lat: 51.51, lng: -0.13, image: "/images/london.png" },
  { name: "Paris", lat: 48.86, lng: 2.35, image: "/images/paris.png" },
  { name: "Madrid", lat: 40.42, lng: -3.7, image: "/images/city-dusk.png" },
  { name: "Miami", lat: 25.76, lng: -80.19, image: "/images/ocean.png" },
  { name: "Cabo", lat: 22.89, lng: -109.92, image: "/images/cabo.png" },
  { name: "Ibiza", lat: 38.91, lng: 1.44, image: "/images/ibiza.png" },
  { name: "Aspen", lat: 39.19, lng: -106.82, image: "/images/mountains.png" },
  { name: "Monaco", lat: 43.74, lng: 7.42, image: "/images/monaco.png" },
  { name: "Dubai", lat: 25.2, lng: 55.27, image: "/images/dubai.png" },
  { name: "Nassau", lat: 25.06, lng: -77.35, image: "/images/ocean.png" },
  { name: "Tokyo", lat: 35.68, lng: 139.69, image: "/images/tokyo.png" },
];
