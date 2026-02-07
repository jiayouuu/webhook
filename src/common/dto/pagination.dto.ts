import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNum?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;
}

export class PaginatedResult<T> {
  list: T[];
  pageInfo: {
    total: number;
    pageNum: number;
    pageSize: number;
    totalPages: number;
  };

  constructor(list: T[], total: number, pageNum: number, pageSize: number) {
    this.list = list;
    this.pageInfo = {
      total,
      pageNum,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
