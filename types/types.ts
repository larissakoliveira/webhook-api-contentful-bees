export interface EmailRegistration {
    email: string;
    relatedProduct: {
      sys: {
        type: string;
        linkType: string;
        id: string;
      };
    };
    entryId: string;
    language: string;
  }
  
  export type WebhookPayload = {
    metadata: {
      tags: any[];
      concepts: any[];
    };
    fields: {
      productNameEnglish: {
        'en-US': string;
      };
      productNameDutch: {
        'en-US': string;
      };
      productNamePortuguese: {
        'en-US': string;
      };
      productNameGerman: {
        'en-US': string;
      };
      descriptionEnglish: {
        'en-US': string;
      };
      descriptionDutch: {
        'en-US': string;
      };
      descriptionPortuguese: {
        'en-US': string;
      };
      descriptionGerman: {
        'en-US': string;
      };
      image: {
        'en-US': {
          sys: {
            type: string;
            linkType: string;
            id: string;
          };
        };
      };
      inStock: {
        'en-US': boolean;
      };
    };
    sys: {
      type: string;
      id: string;
      space: {
        sys: {
          type: string;
          linkType: string;
          id: string;
        };
      };
      environment: {
        sys: {
          id: string;
          type: string;
          linkType: string;
        };
      };
      contentType: {
        sys: {
          type: string;
          linkType: string;
          id: string;
        };
      };
      createdBy: {
        sys: {
          type: string;
          linkType: string;
          id: string;
        };
      };
      updatedBy: {
        sys: {
          type: string;
          linkType: string;
          id: string;
        };
      };
      revision: number;
      createdAt: string;
      updatedAt: string;
    };
  };

  export interface productNameLanguage {
    en: string;
    nl: string;
    pt: string;
    de: string;
}