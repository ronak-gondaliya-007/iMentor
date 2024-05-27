import mongoose, { Model } from "mongoose";

export interface db_function {
  [key: string]: any;
  collection: string;
  query?: any;
  options?: any;
  project?: any;
  limit?: number;
  skip?: number;
  populate?: any;
  sort?: any;
  time?: any;
  value?: any;
  id?: any;
  update?: any;
  document?: any;
  documents?: any;
  pipeline?: any;
}

interface PaginateModel<T> extends Model<T> {
  paginate(query: any, options: any): Promise<any>; // Adjust the return type as needed
}
export interface Schema {
  [key: string]: mongoose.Model<any, any>;
}

export interface forPagination {
  [key: string]: PaginateModel<any>;
}
