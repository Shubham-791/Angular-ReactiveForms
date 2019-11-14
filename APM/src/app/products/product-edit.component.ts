import { Component, OnInit, AfterViewInit, OnDestroy, ViewChildren, ElementRef } from '@angular/core';
import {
  FormBuilder, FormGroup, FormControl, FormArray, Validators, FormControlName,
  ValidatorFn, AbstractControl, Validator
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { Observable, Subscription, fromEvent, merge } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { Product } from './product';
import { ProductService } from './product.service';

import { NumberValidators } from '../shared/number.validator';
import { GenericValidator } from '../shared/generic-validator';


@Component({
  templateUrl: './product-edit.component.html'
})
export class ProductEditComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren(FormControlName, { read: ElementRef }) formInputElements: ElementRef[];
  @ViewChildren('tagInput', { read: ElementRef }) tagInputs: ElementRef[];

  pageTitle = 'Product Edit';
  errorMessage: string;
  productForm: FormGroup;
  colorValMap: { [key: string]: string };
  product: Product;
  private sub: Subscription;

  // Use with the generic validation message class
  displayMessage: { [key: string]: string } = {};
  private validationMessages: { [key: string]: { [key: string]: string } };
  private genericValidator: GenericValidator;

  get tags(): FormArray {
    return this.productForm.get('tags') as FormArray;
  }

  constructor(private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService) {

    // Defines all of the validation messages for the form.
    // These could instead be retrieved from a file or database.
    this.validationMessages = {
      productName: {
        required: 'Product name is required.',
        minlength: 'Product name must be at least three characters.',
        maxlength: 'Product name cannot exceed 50 characters.'
      },
      productCode: {
        required: 'Product code is required.'
      },
      starRating: {
        range: 'Rate the product between 1 (lowest) and 5 (highest).'
      }
    };

    // Define an instance of the validator for use with this form,
    // passing in this form's set of validation messages.
    this.genericValidator = new GenericValidator(this.validationMessages);
    this.colorValMap = {};

  }

  ngOnInit(): void {
    this.productForm = this.fb.group({
      productName: ['', [Validators.required,
      Validators.minLength(3),
      Validators.maxLength(50)]],
      productCode: ['', Validators.required],
      starRating: ['', NumberValidators.range(1, 5)],
      tags: this.fb.array([]),
      description: ''
    });

    // Read the product Id from the route parameter
    this.sub = this.route.paramMap.subscribe(
      params => {
        const id = +params.get('id');
        this.getProduct(id);
      }
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  ngAfterViewInit(): void {
    // Watch for the blur event from any input element on the form.
    // This is required because the valueChanges does not provide notification on blur
    const controlBlurs: Observable<any>[] = this.formInputElements
      .map((formControl: ElementRef) => fromEvent(formControl.nativeElement, 'blur'));
    // Merge the blur event observable with the valueChanges observable
    // so we only need to subscribe once.
    merge(this.productForm.valueChanges, ...controlBlurs).pipe(
      debounceTime(800)
    ).subscribe(value => {
      this.displayMessage = this.genericValidator.processMessages(this.productForm);
    });
  }

  addTag(): void {
    this.tags.push(new FormControl('', [Validators.minLength(3)]));
  }

  deleteTag(index: number): void {
    this.tags.removeAt(index);
    this.tags.markAsDirty();
  }

  getProduct(id: number): void {
    this.productService.getProduct(id)
      .subscribe({
        next: (product: Product) => this.displayProduct(product),
        error: err => this.errorMessage = err
      });
  }
  // Unique Validator for FormControl Tag; doesn't work in all cases such as mutiple tags having the same name 
  // all will be highlighted; after the matching tag is delted still the other tag shows the error because 
  // the validator doesn't run, use formArray validator for that. 
  tagControlMatcher(): ValidatorFn {
    return (c: AbstractControl): { [key: string]: boolean } | null => {
      const matchedControls = this.tags.controls.filter(refControl => {
        return refControl.value === c.value;
      });
      return (matchedControls.length > 1) ? { 'match': true } : null;
    }
  }
  tagMatcher(): ValidatorFn {
    return (c: AbstractControl): { [key: string]: boolean } | null => {
      let isArrayMatch = false, isControlMatch = false;
      const controlArray = (c as FormArray).controls;
      let errorFormControls: Array<AbstractControl> = [];
      let errorFormControls2: { [key: string]: Array<AbstractControl> } = {};
      this.borderResetForTag();
      Object.assign(errorFormControls, controlArray);
      controlArray.forEach((refControl, i1) => {
        isControlMatch = false;
        controlArray.forEach((control, i2) => {
          if (refControl.value === control.value && i1 !== i2) {
            control.setErrors({ 'match': true });
            isControlMatch = true;
            isArrayMatch = true;
            if (errorFormControls2[control.value]) {
              errorFormControls2[control.value].push(errorFormControls.splice(i2, 1)[0]);
            } else {
              errorFormControls2[control.value] = [errorFormControls.splice(i2, 1)[0]];
            }
          }
        });
        if (!isControlMatch && refControl.errors) {
          const errors = refControl.errors;
          delete errors['match'];
          if (!Object.keys(errors).length) {
            refControl.setErrors(null);
          } else {
            refControl.setErrors(errors);
          }
        }
      });
      Object.keys(errorFormControls2).forEach((keyVal) => {
        if (!this.colorValMap[keyVal]) {
          this.colorValMap[keyVal] = this.getRandomColor();
        }
        this.tagInputs.forEach((tagInput: ElementRef) => {
          if (tagInput.nativeElement.value === keyVal) {
            tagInput.nativeElement.style.border = `1px solid ${this.colorValMap[keyVal]}`;
          }
        });
      });
      console.log(this.tagInputs);
      console.log(errorFormControls2);
      // Code to highlight all the matches except the first one (quite custom ..)
      // errorFormControls = controlArray.filter((control: FormControl) => {
      //   return control.errors && control.errors.hasOwnProperty('match');
      // });
      // if (errorFormControls.length) {
      //   console.log(errorFormControls);
      //   delete errorFormControls[0].errors['match'];
      //   if (!Object.keys(errorFormControls[0].errors).length) {
      //     errorFormControls[0].setErrors(null);
      //   }
      // }
      return isArrayMatch ? { 'match': true } : null;
    }
  }
  borderResetForTag() {
    this.tagInputs.forEach((tagInput: ElementRef) => {
      tagInput.nativeElement.style.border = "";
    });
  }
  getRandomColor() {
    let letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }
  displayProduct(product: Product): void {
    if (this.productForm) {
      this.productForm.reset();
    }
    this.product = product;

    if (this.product.id === 0) {
      this.pageTitle = 'Add Product';
    } else {
      this.pageTitle = `Edit Product: ${this.product.productName}`;
    }

    // Update the data on the form
    this.productForm.patchValue({
      productName: this.product.productName,
      productCode: this.product.productCode,
      starRating: this.product.starRating,
      description: this.product.description
    });
    let productTags = this.product.tags.map(tag => [tag, [Validators.minLength(3)]]);
    this.productForm.setControl('tags', this.fb.array(productTags || [], this.tagMatcher()));
  }

  deleteProduct(): void {
    if (this.product.id === 0) {
      // Don't delete, it was never saved.
      this.onSaveComplete();
    } else {
      if (confirm(`Really delete the product: ${this.product.productName}?`)) {
        this.productService.deleteProduct(this.product.id)
          .subscribe({
            next: () => this.onSaveComplete(),
            error: err => this.errorMessage = err
          });
      }
    }
  }

  saveProduct(): void {
    if (this.productForm.valid) {
      if (this.productForm.dirty) {
        const p = { ...this.product, ...this.productForm.value };

        if (p.id === 0) {
          this.productService.createProduct(p)
            .subscribe({
              next: () => this.onSaveComplete(),
              error: err => this.errorMessage = err
            });
        } else {
          this.productService.updateProduct(p)
            .subscribe({
              next: () => this.onSaveComplete(),
              error: err => this.errorMessage = err
            });
        }
      } else {
        this.onSaveComplete();
      }
    } else {
      this.errorMessage = 'Please correct the validation errors.';
    }
  }

  onSaveComplete(): void {
    // Reset the form to clear the flags
    this.productForm.reset();
    this.router.navigate(['/products']);
  }
}
