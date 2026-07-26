package ai.adflow.api.store.library;

import ai.adflow.api.store.StoreController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 경로는 프론트의 /api/stores/library 와 맞춘다 — 라우트가 얇은 프록시가 되도록. */
@RestController
@RequestMapping("/stores/library")
public class LibraryController extends StoreController<LibraryItem> {

  public LibraryController(LibraryItemRepository repository) {
    super(repository);
  }
}
