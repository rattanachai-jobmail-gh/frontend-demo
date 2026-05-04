import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RolesCheck } from './roles-check';

describe('RolesCheck', () => {
  let component: RolesCheck;
  let fixture: ComponentFixture<RolesCheck>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RolesCheck]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RolesCheck);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
