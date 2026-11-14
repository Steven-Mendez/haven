// Items: tipos compartidos entre web (Next.js), mobile (Expo) y la API.
export type Item = {
  _id: string;
  title: string;
  done: boolean;
  createdAt: string;
};

export type CreateItemInput = Pick<Item, 'title'>;
